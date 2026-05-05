import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@grc/db";
import {
  ONBOARDING_MANUAL_INTEGRATION_PROVIDER,
  postOnboardingCompleteStepBodySchema,
} from "@grc/types";
import { ensureTenantSchemaNameOrReply } from "../../lib/tenant-schema.js";
import { requireRole, requireTier } from "../../middleware/rbac.js";
import {
  computeOnboardingSteps,
  finalizeDismissIfComplete,
} from "../../services/onboarding-progress.js";

const onboardingPreHandlers = [requireTier("starter"), requireRole("ControlOwner")];

export async function onboardingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/v1/onboarding/progress",
    { preHandler: onboardingPreHandlers },
    async (request, reply) => {
      const schema = request.tenant.schemaName;
      const tenantId = request.tenant.tenantId;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

      const [meta, progress] = await Promise.all([
        prisma.$queryRawUnsafe<Array<{ onboarding_dismissed_at: Date | null }>>(
          `SELECT onboarding_dismissed_at FROM "${schema}".tenants WHERE id = $1 LIMIT 1`,
          tenantId
        ),
        computeOnboardingSteps(schema, tenantId),
      ]);

      return reply.send({
        data: {
          steps: progress.steps,
          completedCount: progress.completedCount,
          total: 5 as const,
          allComplete: progress.allComplete,
          dismissedAt: meta[0]?.onboarding_dismissed_at?.toISOString() ?? null,
        },
      });
    }
  );

  fastify.post(
    "/v1/onboarding/complete-step",
    { preHandler: onboardingPreHandlers },
    async (request, reply) => {
      const parsed = postOnboardingCompleteStepBodySchema.safeParse(
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

      const schema = request.tenant.schemaName;
      const tenantId = request.tenant.tenantId;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

      const { step } = parsed.data;

      if (step === "integration") {
        const existing = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
          `SELECT COUNT(*)::bigint AS c FROM "${schema}".integration_configs WHERE status = 'connected'`
        );
        const count = Number(existing[0]?.c ?? 0);
        if (count === 0) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "${schema}".integration_configs (provider, status, config)
             VALUES ($1, 'connected', '{}'::jsonb)`,
            ONBOARDING_MANUAL_INTEGRATION_PROVIDER
          );
        }
      }

      if (step === "first_report") {
        await prisma.$executeRawUnsafe(
          `UPDATE "${schema}".tenants
           SET onboarding_first_report_completed_at = COALESCE(onboarding_first_report_completed_at, NOW()),
               updated_at = NOW()
           WHERE id = $1`,
          tenantId
        );
      }

      await finalizeDismissIfComplete(schema, tenantId);

      const refreshed = await computeOnboardingSteps(schema, tenantId);
      const meta = await prisma.$queryRawUnsafe<
        Array<{ onboarding_dismissed_at: Date | null }>
      >(`SELECT onboarding_dismissed_at FROM "${schema}".tenants WHERE id = $1 LIMIT 1`, tenantId);

      return reply.send({
        data: {
          steps: refreshed.steps,
          completedCount: refreshed.completedCount,
          total: 5 as const,
          allComplete: refreshed.allComplete,
          dismissedAt: meta[0]?.onboarding_dismissed_at?.toISOString() ?? null,
        },
      });
    }
  );

  fastify.post(
    "/v1/onboarding/dismiss",
    { preHandler: onboardingPreHandlers },
    async (request, reply) => {
      const schema = request.tenant.schemaName;
      const tenantId = request.tenant.tenantId;
      if (!ensureTenantSchemaNameOrReply(reply, schema)) return;

      const progress = await computeOnboardingSteps(schema, tenantId);
      if (!progress.allComplete) {
        return reply.code(400).send({
          error: {
            code: "ONBOARDING_INCOMPLETE",
            message: "Complete all setup steps before dismissing",
          },
        });
      }

      await prisma.$executeRawUnsafe(
        `UPDATE "${schema}".tenants
         SET onboarding_dismissed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        tenantId
      );

      const meta = await prisma.$queryRawUnsafe<
        Array<{ onboarding_dismissed_at: Date | null }>
      >(`SELECT onboarding_dismissed_at FROM "${schema}".tenants WHERE id = $1 LIMIT 1`, tenantId);

      return reply.send({
        data: {
          dismissedAt: meta[0]?.onboarding_dismissed_at?.toISOString() ?? null,
        },
      });
    }
  );
}
