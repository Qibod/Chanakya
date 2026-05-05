import type { FastifyInstance, FastifyRequest } from "fastify";
import { v7 as uuidv7 } from "uuid";
import { prisma } from "@grc/db";
import {
  computeIncrementalCoverage,
  computeOverlapPercent,
  computeRecommendedFrameworks,
  controlCountForFramework,
  estimatedGapsForFramework,
  formatNewFrameworksLabel,
  FRAMEWORK_IDS,
  FRAMEWORK_LIBRARY_META,
  fingerprintInferencePayloadSchema,
  mergeCanonicalControlsForFrameworks,
  maxFrameworkSelectionsForTier,
  parseFrameworkRefsArray,
  patchControlBodySchema,
  postFrameworkActivateBodySchema,
  type FrameworkId,
  validateFrameworkSelectionCount,
} from "@grc/types";
import { auditIpFromRequest } from "../../lib/audit-ip.js";
import { ensureTenantSchemaNameOrReply } from "../../lib/tenant-schema.js";
import { requireRole, requireTier } from "../../middleware/rbac.js";
import { finalizeDismissIfComplete } from "../../services/onboarding-progress.js";

const frameworksPreHandlers = [requireTier("starter"), requireRole("ControlOwner")];

/** Postgres 23505 / Prisma P2002 — concurrent activation or duplicate framework insert. */
function isPostgresUniqueViolation(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    const o = err as { code?: string };
    if (o.code === "P2002" || o.code === "23505") return true;
  }
  return /\b(?:23505|P2002)\b/.test(String(err));
}

export async function frameworkRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/v1/frameworks/library",
    { preHandler: frameworksPreHandlers },
    async (request, reply) => {
      const schema = request.tenant.schemaName;
      const tier = request.tenant.tier;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

      const activatedRows = await prisma.$queryRawUnsafe<Array<{ framework: string }>>(
        `SELECT framework FROM "${schema}".framework_activations ORDER BY framework`
      );
      const activatedSet = new Set(activatedRows.map((r) => r.framework as FrameworkId));

      const fpRows = await prisma.$queryRawUnsafe<Array<{ data: unknown }>>(
        `SELECT data FROM "${schema}".fingerprint_results
         WHERE status = 'committed' AND data IS NOT NULL AND data <> '{}'::jsonb
         ORDER BY confirmed_at DESC NULLS LAST, updated_at DESC
         LIMIT 1`
      );

      let recommended: FrameworkId[] = ["SOC2"];
      const raw = fpRows[0]?.data;
      if (raw != null) {
        const parsed = fingerprintInferencePayloadSchema.safeParse(raw);
        if (parsed.success) {
          recommended = computeRecommendedFrameworks(parsed.data);
        }
      }

      const maxSelectable = maxFrameworkSelectionsForTier(tier);

      const frameworks = FRAMEWORK_IDS.map((id) => ({
        id,
        title: FRAMEWORK_LIBRARY_META[id].title,
        shortDescription: FRAMEWORK_LIBRARY_META[id].shortDescription,
        controlCount: controlCountForFramework(id),
        estimatedGaps: estimatedGapsForFramework(id),
        recommended: recommended.includes(id),
        alreadyActivated: activatedSet.has(id),
      }));

      return reply.send({
        data: {
          tier,
          maxSelectable,
          recommended,
          frameworks,
        },
      });
    }
  );

  fastify.post(
    "/v1/frameworks/activate",
    { preHandler: frameworksPreHandlers },
    async (request, reply) => {
      const parsed = postFrameworkActivateBodySchema.safeParse(
        (request as FastifyRequest<{ Body: unknown }>).body
      );
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parsed.error.flatten(),
          },
        });
      }

      const { frameworkIds } = parsed.data;
      const tier = request.tenant.tier;
      const schema = request.tenant.schemaName;
      const tenantId = request.tenant.tenantId;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;
      const userId = request.user.userId;

      const [existingRows, existingCanonRows] = await Promise.all([
        prisma.$queryRawUnsafe<Array<{ framework: string }>>(
          `SELECT framework FROM "${schema}".framework_activations`
        ),
        prisma.$queryRawUnsafe<Array<{ canonical_id: string }>>(
          `SELECT canonical_id FROM "${schema}".control_items`
        ),
      ]);
      const existing = new Set(existingRows.map((r) => r.framework as FrameworkId));

      for (const id of frameworkIds) {
        if (existing.has(id)) {
          return reply.code(409).send({
            error: {
              code: "FRAMEWORK_ALREADY_ACTIVE",
              message: `Framework ${id} is already activated`,
            },
          });
        }
      }

      const combined = [...new Set([...existing, ...frameworkIds])];
      const tierErr = validateFrameworkSelectionCount(tier, combined.length);
      if (tierErr) {
        return reply.code(400).send({
          error: { code: "TIER_SELECTION_LIMIT", message: tierErr },
        });
      }

      const mergedRows = mergeCanonicalControlsForFrameworks(combined);
      const overlapPercent = computeOverlapPercent(combined, mergedRows);

      const existingCanonicalIds = new Set(existingCanonRows.map((r) => r.canonical_id));
      const coverage = computeIncrementalCoverage(existingCanonicalIds, frameworkIds);
      const frameworkLabel = formatNewFrameworksLabel(frameworkIds);
      const coverageBreakdown: Record<string, number> = {};
      for (const fid of frameworkIds) {
        coverageBreakdown[fid] = coverage.perFramework[fid] ?? 0;
      }

      const ipAddress = auditIpFromRequest(request);

      const resourceId = [...frameworkIds].sort().join(",");

      try {
        await prisma.$transaction(async (tx) => {
          for (const fid of frameworkIds) {
            await tx.$executeRawUnsafe(
              `INSERT INTO "${schema}".framework_activations (id, framework, activated_by)
               VALUES ($1, $2, $3)`,
              uuidv7(),
              fid,
              userId
            );
          }

          for (const row of mergedRows) {
            const refsJson = JSON.stringify(row.frameworkRefs);
            await tx.$executeRawUnsafe(
              `INSERT INTO "${schema}".control_items
                (id, canonical_id, framework, control_code, framework_refs, domain, name, status)
               VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, 'pending')
               ON CONFLICT (canonical_id) DO UPDATE SET
                 framework_refs = EXCLUDED.framework_refs,
                 updated_at = NOW()`,
              uuidv7(),
              row.canonicalId,
              row.primaryFramework,
              row.primaryControlCode,
              refsJson,
              row.domain,
              row.name
            );
          }

          await tx.platformAuditLog.create({
            data: {
              tenantId,
              actorId: userId,
              action: "framework.activated",
              resourceType: "framework_bundle",
              resourceId,
              ipAddress: ipAddress ?? null,
            },
          });
        });

        return reply.send({
          data: {
            activated: frameworkIds,
            controlsCreated: mergedRows.length,
            overlapPercent,
            alreadyCoveredCount: coverage.alreadyCoveredCount,
            frameworkLabel,
            coverageBreakdown,
          },
        });
      } catch (err) {
        if (isPostgresUniqueViolation(err)) {
          return reply.code(409).send({
            error: {
              code: "FRAMEWORK_ALREADY_ACTIVE",
              message:
                "A framework is already activated or another request completed first. Refresh and try again.",
            },
          });
        }
        fastify.log.error({ err, tenantId }, "framework activation failed");
        return reply.code(500).send({
          error: { code: "ACTIVATION_FAILED", message: "Could not activate frameworks" },
        });
      }
    }
  );

  fastify.get(
    "/v1/controls",
    { preHandler: frameworksPreHandlers },
    async (request, reply) => {
      const schema = request.tenant.schemaName;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;
      const raw = request.query as Record<string, string | undefined>;
      const limitParsed = Math.min(
        500,
        Math.max(1, parseInt(String(raw["limit"] ?? "100"), 10) || 100)
      );
      const after =
        typeof raw["after"] === "string" && raw["after"].length > 0 ? raw["after"] : null;

      const countRows = await prisma.$queryRawUnsafe<Array<{ c: string }>>(
        `SELECT COUNT(*)::text AS c FROM "${schema}".control_items`
      );
      const total = Number(countRows[0]?.c ?? 0);

      const fetchLimit = limitParsed + 1;
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          canonical_id: string;
          name: string;
          domain: string;
          status: string;
          framework: string;
          framework_refs: unknown;
        }>
      >(
        after
          ? `SELECT id, canonical_id, name, domain, status, framework, framework_refs
             FROM "${schema}".control_items WHERE id > $1 ORDER BY id ASC LIMIT $2`
          : `SELECT id, canonical_id, name, domain, status, framework, framework_refs
             FROM "${schema}".control_items ORDER BY id ASC LIMIT $1`,
        ...(after ? [after, fetchLimit] : [fetchLimit])
      );

      const hasMore = rows.length > limitParsed;
      const pageRows = hasMore ? rows.slice(0, limitParsed) : rows;
      const nextCursor =
        hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1]!.id : null;

      const items = pageRows.map((r) => ({
        id: r.id,
        canonicalId: r.canonical_id,
        name: r.name,
        domain: r.domain,
        status: r.status,
        framework: r.framework,
        frameworkRefs: Array.isArray(r.framework_refs)
          ? (r.framework_refs as string[])
          : typeof r.framework_refs === "string"
            ? (JSON.parse(r.framework_refs) as string[])
            : [],
      }));

      return reply.send({
        data: {
          total,
          items,
          nextCursor,
        },
      });
    }
  );

  fastify.get(
    "/v1/controls/:id",
    { preHandler: frameworksPreHandlers },
    async (request, reply) => {
      const schema = request.tenant.schemaName;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

      const id = (request as FastifyRequest<{ Params: { id: string } }>).params?.id;
      if (!id) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Control id required" },
        });
      }

      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          canonical_id: string;
          name: string;
          domain: string;
          status: string;
          framework: string;
          framework_refs: unknown;
        }>
      >(
        `SELECT id, canonical_id, name, domain, status, framework, framework_refs
         FROM "${schema}".control_items WHERE id = $1 LIMIT 1`,
        id
      );

      const row = rows[0];
      if (!row) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Control not found" },
        });
      }

      const frameworkRefs = Array.isArray(row.framework_refs)
        ? (row.framework_refs as string[])
        : typeof row.framework_refs === "string"
          ? (JSON.parse(row.framework_refs) as string[])
          : [];

      const requirementDetails = parseFrameworkRefsArray(frameworkRefs).map((p) => ({
        frameworkId: p.frameworkId,
        frameworkTitle: FRAMEWORK_LIBRARY_META[p.frameworkId].title,
        code: p.code,
      }));

      return reply.send({
        data: {
          id: row.id,
          canonicalId: row.canonical_id,
          name: row.name,
          domain: row.domain,
          status: row.status,
          framework: row.framework,
          frameworkRefs,
          requirementDetails,
        },
      });
    }
  );

  fastify.patch(
    "/v1/controls/:id",
    { preHandler: frameworksPreHandlers },
    async (request, reply) => {
      const schema = request.tenant.schemaName;
      const tenantId = request.tenant.tenantId;
      const userId = request.user?.userId ?? "";
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

      const id = (request as FastifyRequest<{ Params: { id: string } }>).params?.id;
      if (!id) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Control id required" },
        });
      }

      const parsed = patchControlBodySchema.safeParse(
        (request as FastifyRequest<{ Body: unknown }>).body
      );
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parsed.error.flatten(),
          },
        });
      }

      const updated = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `UPDATE "${schema}".control_items
         SET assigned_to = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id`,
        userId,
        id
      );

      if (!updated[0]?.id) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Control not found" },
        });
      }

      await finalizeDismissIfComplete(schema, tenantId);

      return reply.send({
        data: {
          id: updated[0].id,
          assignedTo: userId,
        },
      });
    }
  );
}
