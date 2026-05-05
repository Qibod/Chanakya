import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@grc/db";
import { ROLE_SATISFIES } from "@grc/types";
import {
  createBlobStorageFromEnv,
  readVerifiedBlobBytes,
} from "@grc/evidence-ingestion";
import { ensureTenantSchemaNameOrReply } from "../../lib/tenant-schema.js";
import { requireTier } from "../../middleware/rbac.js";

async function ensureEvidenceDownloadAccess(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = request.user;
  const tenant = request.tenant;
  const schema = tenant?.schemaName;
  const evidenceItemId = (request.params as { evidenceItemId?: string }).evidenceItemId;

  if (!evidenceItemId) {
    return reply.code(400).send({
      error: { code: "VALIDATION_ERROR", message: "Evidence item id required" },
    });
  }

  if (!user?.userId || !schema) {
    return reply.code(401).send({
      error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    });
  }

  if (ROLE_SATISFIES[user.role]?.includes("AuditDirector")) {
    return;
  }

  if (user.role === "ControlOwner") {
    const rows = await prisma.$queryRawUnsafe<Array<{ ok: number }>>(
      `SELECT 1 AS ok
       FROM "${schema}".evidence_items ei
       JOIN "${schema}".control_assignments ca
         ON ca.control_item_id = ei.control_item_id
       WHERE ei.id = $1 AND ca.assigned_to = $2 AND ca.is_current = TRUE
       LIMIT 1`,
      evidenceItemId,
      user.userId
    );
    if (rows.length > 0) {
      return;
    }
  }

  return reply.code(403).send({
    error: { code: "FORBIDDEN", message: "Insufficient permissions" },
  });
}

export async function evidenceItemRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/v1/evidence-items/:evidenceItemId/download",
    {
      preHandler: [
        requireTier("starter"),
        ensureEvidenceDownloadAccess,
      ],
    },
    async (request, reply) => {
      const schema = request.tenant.schemaName;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

      const userId = request.user?.userId;
      const tenantId = request.tenant.tenantId;
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        });
      }

      const evidenceItemId = (request as FastifyRequest<{ Params: { evidenceItemId: string } }>).params
        ?.evidenceItemId;
      if (!evidenceItemId) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Evidence item id required" },
        });
      }

      const rows = await prisma.$queryRawUnsafe<
        Array<{
          storage_path: string;
          content_hash: string;
          mime_type: string | null;
          file_name: string;
        }>
      >(
        `SELECT b.storage_path, b.content_hash, b.mime_type, i.file_name
         FROM "${schema}".evidence_items i
         JOIN "${schema}".evidence_blobs b ON b.id = i.blob_id
         WHERE i.id = $1
         LIMIT 1`,
        evidenceItemId
      );

      const row = rows[0];
      if (!row) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Evidence item not found" },
        });
      }

      const storage = createBlobStorageFromEnv();

      try {
        const bytes = await readVerifiedBlobBytes({
          storage,
          storagePath: row.storage_path,
          expectedContentHashHex: row.content_hash,
        });

        const mime = row.mime_type ?? "application/octet-stream";
        reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(row.file_name)}"`);
        return reply.type(mime).send(bytes);
      } catch (e) {
        const code = (e as Error & { code?: string })?.code;
        if (code === "EVIDENCE_INTEGRITY_FAILURE") {
          await prisma.platformAuditLog.create({
            data: {
              tenantId,
              actorId: userId,
              action: "evidence.integrity_failure",
              resourceType: "evidence_item",
              resourceId: evidenceItemId,
              ipAddress: request.ip,
            },
          });
          request.log.error({ evidenceItemId, tenantId }, "Evidence integrity verification failed");
          return reply.code(500).send({
            error: {
              code: "EVIDENCE_INTEGRITY_FAILURE",
              message: "Stored evidence failed integrity verification",
            },
          });
        }
        throw e;
      }
    }
  );
}
