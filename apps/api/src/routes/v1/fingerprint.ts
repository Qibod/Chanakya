import type { FastifyInstance, FastifyRequest } from "fastify";
import { v7 as uuidv7 } from "uuid";
import { prisma } from "@grc/db";
import {
  applyFingerprintConfirmEdits,
  fingerprintInferencePayloadSchema,
  postFingerprintBodySchema,
  postFingerprintConfirmBodySchema,
} from "@grc/types";
import { redis } from "../../plugins/redis.js";
import { requireRole, requireTier } from "../../middleware/rbac.js";
import { auditIpFromRequest } from "../../lib/audit-ip.js";
import { ensureTenantSchemaNameOrReply } from "../../lib/tenant-schema.js";
import { deliverFingerprintTask } from "../../services/fingerprint-queue.js";

const JOB_STATE_PREFIX = "grc:job:";
const JOB_TTL_SEC = 86_400;

/** Onboarding AI jobs: Starter+ and must not be Read-only (excludes pure viewers). */
const fingerprintPreHandlers = [requireTier("starter"), requireRole("ControlOwner")];

export async function fingerprintRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/v1/fingerprint",
    {
      preHandler: fingerprintPreHandlers,
    },
    async (request, reply) => {
      const parsed = postFingerprintBodySchema.safeParse(
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

      const { companyName } = parsed.data;
      const tenantId = request.tenant.tenantId;
      const schema = request.tenant.schemaName;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;
      const jobId = `${tenantId}.fingerprint.${uuidv7()}`;

      await prisma.$executeRawUnsafe(
        `INSERT INTO "${schema}".fingerprint_results (job_id, company_name, status, data)
         VALUES ($1, $2, 'queued', '{}'::jsonb)`,
        jobId,
        companyName
      );

      await redis.set(
        `${JOB_STATE_PREFIX}${jobId}`,
        JSON.stringify({
          status: "pending",
          tenantId,
          createdAt: new Date().toISOString(),
        }),
        "EX",
        JOB_TTL_SEC
      );

      try {
        await deliverFingerprintTask({
          tenantId,
          schemaName: request.tenant.schemaName,
          jobId,
          companyName,
        });
      } catch (err) {
        fastify.log.error({ err, jobId, tenantId }, "fingerprint enqueue failed");
        await prisma.$executeRawUnsafe(
          `UPDATE "${schema}".fingerprint_results SET status = 'failed', failure_reason = $1, updated_at = NOW() WHERE job_id = $2`,
          "WORKER_ENQUEUE_FAILED",
          jobId
        );
        await redis.set(
          `${JOB_STATE_PREFIX}${jobId}`,
          JSON.stringify({
            status: "failed",
            tenantId,
            error: "WORKER_ENQUEUE_FAILED",
            completedAt: new Date().toISOString(),
          }),
          "EX",
          JOB_TTL_SEC
        );
        return reply.code(503).send({
          error: {
            code: "WORKER_UNAVAILABLE",
            message: "Could not start fingerprint job",
          },
        });
      }

      fastify.log.info({ jobId, tenantId }, "fingerprint job enqueued");
      return reply.code(202).send({ data: { jobId } });
    }
  );

  fastify.get(
    "/v1/fingerprint/:jobId",
    {
      preHandler: fingerprintPreHandlers,
    },
    async (request, reply) => {
      const { jobId } = (request as FastifyRequest<{ Params: { jobId: string } }>).params;
      const tenantId = request.tenant.tenantId;
      if (!jobId.startsWith(`${tenantId}.fingerprint.`)) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Job does not belong to this tenant" },
        });
      }

      const schema = request.tenant.schemaName;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          job_id: string;
          status: string;
          failure_reason: string | null;
          data: unknown;
          company_name: string;
        }>
      >(
        `SELECT job_id, status, failure_reason, data, company_name
         FROM "${schema}".fingerprint_results WHERE job_id = $1 LIMIT 1`,
        jobId
      );

      const row = rows[0];
      if (!row) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Fingerprint job not found" },
        });
      }

      const cached = await redis.get(`${JOB_STATE_PREFIX}${jobId}`);
      let jobStatus: string | undefined;
      if (cached) {
        try {
          const j = JSON.parse(cached) as { status?: string };
          jobStatus = j.status;
        } catch {
          /* ignore */
        }
      }

      return reply.send({
        data: {
          jobId: row.job_id,
          rowStatus: row.status,
          failureReason: row.failure_reason,
          companyName: row.company_name,
          inference: row.status === "pending_review" || row.status === "committed" ? row.data : null,
          redisJobStatus: jobStatus ?? null,
        },
      });
    }
  );

  fastify.post(
    "/v1/fingerprint/:jobId/confirm",
    {
      preHandler: fingerprintPreHandlers,
    },
    async (request, reply) => {
      const { jobId } = (request as FastifyRequest<{ Params: { jobId: string } }>).params;
      const tenantId = request.tenant.tenantId;
      if (!jobId.startsWith(`${tenantId}.fingerprint.`)) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Job does not belong to this tenant" },
        });
      }

      const parsedBody = postFingerprintConfirmBodySchema.safeParse(
        (request as FastifyRequest<{ Body: unknown }>).body
      );
      if (!parsedBody.success) {
        return reply.code(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parsedBody.error.flatten(),
          },
        });
      }

      const schema = request.tenant.schemaName;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          job_id: string;
          status: string;
          data: unknown;
        }>
      >(
        `SELECT job_id, status, data
         FROM "${schema}".fingerprint_results WHERE job_id = $1 LIMIT 1`,
        jobId
      );

      const row = rows[0];
      if (!row) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Fingerprint job not found" },
        });
      }

      if (row.status === "committed") {
        return reply.code(409).send({
          error: { code: "ALREADY_COMMITTED", message: "Fingerprint result already committed" },
        });
      }
      if (row.status === "failed" || row.status === "queued") {
        return reply.code(400).send({
          error: {
            code: "INVALID_STATE",
            message: `Cannot confirm fingerprint in status: ${row.status}`,
          },
        });
      }
      if (row.status !== "pending_review") {
        return reply.code(400).send({
          error: { code: "INVALID_STATE", message: `Unexpected status: ${row.status}` },
        });
      }

      const baseParse = fingerprintInferencePayloadSchema.safeParse(row.data);
      if (!baseParse.success) {
        return reply.code(500).send({
          error: { code: "DATA_CORRUPT", message: "Stored fingerprint data is invalid" },
        });
      }

      const merged = applyFingerprintConfirmEdits(
        baseParse.data,
        parsedBody.data.overrides,
        parsedBody.data.removedLineIds
      );

      const mergedParse = fingerprintInferencePayloadSchema.safeParse(merged);
      if (!mergedParse.success) {
        const details = mergedParse.error.flatten();
        const emptyList =
          merged.regulatoryObligations.length === 0 ||
          merged.businessProcesses.length === 0 ||
          merged.riskDomains.length === 0;
        fastify.log.warn({ jobId, details }, "fingerprint confirm merge failed validation");
        return reply.code(400).send({
          error: {
            code: emptyList ? "REQUIRED_LIST_EMPTY" : "VALIDATION_ERROR",
            message: emptyList
              ? "At least one line must remain in each of obligations, business processes, and risk domains."
              : "Edits would produce an invalid fingerprint payload.",
            details,
          },
        });
      }

      const finalPayload = mergedParse.data;

      const dataJson = JSON.stringify(finalPayload);
      const scoresJson = JSON.stringify({
        industryConfidence: finalPayload.industryClassification.confidence,
      });
      const industryTitle = finalPayload.industryClassification.title;

      const ipAddress = auditIpFromRequest(request);

      const userId = request.user.userId;
      const overridesCount = Object.keys(parsedBody.data.overrides ?? {}).length;
      const removedCount = parsedBody.data.removedLineIds?.length ?? 0;

      try {
        await prisma.$transaction(async (tx) => {
          const updated = await tx.$queryRawUnsafe<Array<{ job_id: string }>>(
            `UPDATE "${schema}".fingerprint_results SET
              status = 'committed',
              data = $1::jsonb,
              confidence_scores = $2::jsonb,
              industry = $3,
              confirmed_at = NOW(),
              updated_at = NOW(),
              failure_reason = NULL
             WHERE job_id = $4 AND status = 'pending_review'
             RETURNING job_id`,
            dataJson,
            scoresJson,
            industryTitle,
            jobId
          );

          if (!updated[0]) {
            throw Object.assign(new Error("STALE_OR_COMMITTED"), { code: "STALE" as const });
          }

          await tx.platformAuditLog.create({
            data: {
              tenantId,
              actorId: userId,
              action: "fingerprint.confirmed",
              resourceType: "fingerprint_job",
              resourceId: jobId,
              ipAddress: ipAddress ?? null,
            },
          });
        });
      } catch (err: unknown) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: string }).code === "STALE"
        ) {
          return reply.code(409).send({
            error: {
              code: "ALREADY_COMMITTED",
              message: "Fingerprint result was already committed",
            },
          });
        }
        fastify.log.error({ err, jobId, tenantId }, "fingerprint confirm failed");
        return reply.code(500).send({
          error: { code: "CONFIRM_FAILED", message: "Could not commit fingerprint results" },
        });
      }

      fastify.log.info(
        { jobId, tenantId, userId, overridesCount, removedCount },
        "fingerprint confirmed"
      );

      return reply.send({ data: { jobId, status: "committed" as const } });
    }
  );
}
