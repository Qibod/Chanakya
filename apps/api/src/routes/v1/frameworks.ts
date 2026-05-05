import type { FastifyInstance, FastifyRequest } from "fastify";
import { v7 as uuidv7 } from "uuid";
import { prisma } from "@grc/db";
import { VertexAIProvider, fallbackInstruction, generateTaskInstructions } from "@grc/ai";
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
  postControlAssignBodySchema,
  postFrameworkActivateBodySchema,
  type FrameworkId,
  validateFrameworkSelectionCount,
} from "@grc/types";
import { auditIpFromRequest } from "../../lib/audit-ip.js";
import { ensureTenantSchemaNameOrReply } from "../../lib/tenant-schema.js";
import { requireRole, requireTier } from "../../middleware/rbac.js";
import { finalizeDismissIfComplete } from "../../services/onboarding-progress.js";

const frameworksPreHandlers = [requireTier("starter"), requireRole("ControlOwner")];
const assignPreHandlers = [requireTier("starter"), requireRole("AuditDirector")];

/** Postgres 23505 / Prisma P2002 — concurrent activation or duplicate framework insert. */
function isPostgresUniqueViolation(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    const o = err as { code?: string };
    if (o.code === "P2002" || o.code === "23505") return true;
  }
  return /\b(?:23505|P2002)\b/.test(String(err));
}

export async function frameworkRoutes(fastify: FastifyInstance): Promise<void> {
  const taskInstructionAi = new VertexAIProvider();

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
          assigned_to: string | null;
          updated_at: Date | string | null;
          framework: string;
          framework_refs: unknown;
        }>
      >(
        after
          ? `SELECT id, canonical_id, name, domain, status, assigned_to, updated_at, framework, framework_refs
             FROM "${schema}".control_items WHERE id > $1 ORDER BY id ASC LIMIT $2`
          : `SELECT id, canonical_id, name, domain, status, assigned_to, updated_at, framework, framework_refs
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
        assignedTo: r.assigned_to ?? null,
        updatedAt:
          r.updated_at instanceof Date
            ? r.updated_at.toISOString()
            : typeof r.updated_at === "string"
              ? r.updated_at
              : null,
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
      const tenantId = request.tenant.tenantId;
      const actorId = request.user?.userId;
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

      // Assignment + instruction regeneration (Story 3.3)
      const [integrationRows, assignmentRows] = await Promise.all([
        prisma.$queryRawUnsafe<Array<{ provider: string }>>(
          `SELECT provider FROM "${schema}".integration_configs
           WHERE status = 'connected'
           ORDER BY provider`
        ),
        prisma.$queryRawUnsafe<
          Array<{
            id: string;
            assigned_to: string;
            due_date: string | null;
            instruction: string;
            instruction_updated_at: Date | string | null;
            instruction_context: unknown;
          }>
        >(
          `SELECT id, assigned_to, due_date, instruction, instruction_updated_at, instruction_context
           FROM "${schema}".control_assignments
           WHERE control_item_id = $1 AND is_current = TRUE
           ORDER BY created_at DESC
           LIMIT 1`,
          id
        ),
      ]);

      const integrationsUsed = integrationRows
        .map((r) => String(r.provider))
        .filter((p) => p.length > 0)
        .sort((a, b) => a.localeCompare(b));

      const assignment = assignmentRows[0] ?? null;
      let instructionRegenerated = false;

      if (assignment && actorId) {
        const rawCtx = assignment.instruction_context;
        const ctx =
          rawCtx && typeof rawCtx === "object"
            ? (rawCtx as { integrations?: unknown })
            : typeof rawCtx === "string"
              ? (JSON.parse(rawCtx) as { integrations?: unknown })
              : {};

        const prevIntegrations = Array.isArray(ctx.integrations)
          ? ctx.integrations.map((x) => String(x)).sort((a, b) => a.localeCompare(b))
          : [];

        const changed =
          prevIntegrations.length !== integrationsUsed.length ||
          prevIntegrations.some((v, i) => v !== integrationsUsed[i]);

        if (changed) {
          let newInstruction = "";
          try {
            newInstruction = await generateTaskInstructions(taskInstructionAi, {
              controlName: row.name,
              domain: row.domain,
              frameworkRefs,
              connectedIntegrations: integrationsUsed,
            });
          } catch (err) {
            fastify.log.warn({ err, tenantId, controlId: id }, "instruction regeneration failed");
            newInstruction = fallbackInstruction(row.name);
          }
          if (!newInstruction) newInstruction = fallbackInstruction(row.name);

          const newContext = {
            integrations: integrationsUsed,
            control: { id: row.id, canonicalId: row.canonical_id, name: row.name },
            frameworkRefs,
          };

          await prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              `UPDATE "${schema}".control_assignments
               SET instruction = $1,
                   instruction_context = $2::jsonb,
                   instruction_updated_at = NOW()
               WHERE id = $3`,
              newInstruction,
              JSON.stringify(newContext),
              assignment.id
            );

            await tx.platformAuditLog.create({
              data: {
                tenantId,
                actorId,
                action: "control.task_instruction_regenerated",
                resourceType: "control_item",
                resourceId: id,
                ipAddress: auditIpFromRequest(request) ?? null,
              },
            });

            await tx.platformAuditLog.create({
              data: {
                tenantId,
                actorId,
                action: "control.task_instruction_updated",
                resourceType: "control_assignment",
                resourceId: assignment.id,
                ipAddress: auditIpFromRequest(request) ?? null,
              },
            });
          });

          instructionRegenerated = true;
          assignment.instruction = newInstruction;
          assignment.instruction_updated_at = new Date().toISOString();
          assignment.instruction_context = newContext;
        }
      }

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
          assignment: assignment
            ? {
                id: assignment.id,
                assignedTo: assignment.assigned_to,
                dueDate: assignment.due_date ?? null,
                instruction: assignment.instruction,
                instructionUpdatedAt:
                  assignment.instruction_updated_at instanceof Date
                    ? assignment.instruction_updated_at.toISOString()
                    : typeof assignment.instruction_updated_at === "string"
                      ? assignment.instruction_updated_at
                      : null,
                integrationsUsed,
              }
            : null,
          instructionRegenerated,
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
      const userId = request.user?.userId;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        });
      }

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

      if (!parsed.data.assignToSelf) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
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

  fastify.post(
    "/v1/controls/:id/assign",
    { preHandler: assignPreHandlers },
    async (request, reply) => {
      const schema = request.tenant.schemaName;
      const tenantId = request.tenant.tenantId;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

      const userId = request.user?.userId;
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        });
      }

      const id = (request as FastifyRequest<{ Params: { id: string } }>).params?.id;
      if (!id) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Control id required" },
        });
      }

      const parsed = postControlAssignBodySchema.safeParse(
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

      const assignedTo = parsed.data.assignedTo;
      const dueDate = parsed.data.dueDate ?? null;

      const [integrationRows, assignedUserRows, controlRows] = await Promise.all([
        prisma.$queryRawUnsafe<Array<{ provider: string }>>(
          `SELECT provider FROM "${schema}".integration_configs
           WHERE status = 'connected'
           ORDER BY provider`
        ),
        prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM "${schema}".users WHERE id = $1 LIMIT 1`,
          assignedTo
        ),
        prisma.$queryRawUnsafe<
          Array<{
            id: string;
            canonical_id: string;
            name: string;
            domain: string;
            framework_refs: unknown;
          }>
        >(
          `SELECT id, canonical_id, name, domain, framework_refs
           FROM "${schema}".control_items WHERE id = $1 LIMIT 1`,
          id
        ),
      ]);

      if (!assignedUserRows[0]?.id) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Assigned user not found" },
        });
      }

      const control = controlRows[0];
      if (!control) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Control not found" },
        });
      }

      const frameworkRefs = Array.isArray(control.framework_refs)
        ? (control.framework_refs as string[])
        : typeof control.framework_refs === "string"
          ? (JSON.parse(control.framework_refs) as string[])
          : [];

      const integrationsUsed = integrationRows
        .map((r) => String(r.provider))
        .filter((p) => p.length > 0)
        .sort((a, b) => a.localeCompare(b));

      let instruction = "";
      let instructionModel = "claude-sonnet-4-6";
      try {
        instruction = await generateTaskInstructions(taskInstructionAi, {
          controlName: control.name,
          domain: control.domain,
          frameworkRefs,
          connectedIntegrations: integrationsUsed,
        });
      } catch (err) {
        fastify.log.warn({ err, tenantId, controlId: id }, "task instruction generation failed");
        instruction = fallbackInstruction(control.name);
      }

      if (!instruction) instruction = fallbackInstruction(control.name);

      const ipAddress = auditIpFromRequest(request);
      const instructionContext = {
        integrations: integrationsUsed,
        control: { id: control.id, canonicalId: control.canonical_id, name: control.name },
        frameworkRefs,
      };

      const assignmentId = uuidv7();

      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `UPDATE "${schema}".control_items
             SET assigned_to = $1, status = 'in_review', updated_at = NOW()
             WHERE id = $2`,
            assignedTo,
            id
          );

          // Preserve history: mark previous "current" assignment as non-current, then insert new row.
          await tx.$executeRawUnsafe(
            `UPDATE "${schema}".control_assignments
             SET is_current = FALSE
             WHERE control_item_id = $1 AND is_current = TRUE`,
            id
          );

          await tx.$executeRawUnsafe(
            `INSERT INTO "${schema}".control_assignments
            (id, control_item_id, assigned_to, assigned_by, due_date, instruction, instruction_model, instruction_context, instruction_updated_at, is_current, business_unit_id, created_at)
           VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8::jsonb, NOW(), TRUE, NULL, NOW())`,
            assignmentId,
            id,
            assignedTo,
            userId,
            dueDate,
            instruction,
            instructionModel,
            JSON.stringify(instructionContext)
          );

          await tx.platformAuditLog.create({
            data: {
              tenantId,
              actorId: userId,
              action: "control.assigned",
              resourceType: "control_item",
              resourceId: id,
              ipAddress: ipAddress ?? null,
            },
          });
        });
      } catch (err) {
        if (isPostgresUniqueViolation(err)) {
          return reply.code(409).send({
            error: {
              code: "ASSIGNMENT_CONFLICT",
              message: "Another assignment was saved for this control; refresh and try again.",
            },
          });
        }
        throw err;
      }

      return reply.send({
        data: {
          /** Control item id (same as URL `:id`). Prefer `controlId` for clarity. */
          id,
          controlId: id,
          assignmentId,
          assignedTo,
          dueDate,
          status: "in_review",
          instruction,
          instructionUpdatedAt: new Date().toISOString(),
          integrationsUsed,
        },
      });
    }
  );
}
