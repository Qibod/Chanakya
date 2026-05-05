/**
 * Admin provisioning endpoint — one-time use for bootstrapping tenant schemas.
 *
 * Gated by ADMIN_PROVISION_SECRET env var (must match the `x-admin-secret` header).
 * This endpoint is intentionally kept minimal and safe: it uses CREATE SCHEMA IF NOT EXISTS
 * and ON CONFLICT DO NOTHING throughout, so it is idempotent.
 *
 * USAGE (once deployed):
 *   curl -X POST https://grc-api-staging-3axm2p6wzq-uc.a.run.app/admin/provision \
 *     -H "x-admin-secret: <ADMIN_PROVISION_SECRET>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"orgId":"org_XXX","orgName":"My Org","userId":"user_XXX","email":"user@example.com","name":"Full Name","grcRole":"AuditDirector"}'
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma, provisionTenantSchema, tenantSchemaName } from "@grc/db";
import type { TenantId } from "@grc/types";

type ProvisionBody = {
  orgId: string;
  orgName?: string;
  userId: string;
  email: string;
  name?: string;
  grcRole: "AuditDirector" | "ControlOwner";
};

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/admin/provision",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const secret = process.env["ADMIN_PROVISION_SECRET"];
      if (!secret) {
        return reply.code(503).send({ error: "Admin provisioning not configured" });
      }

      const provided = request.headers["x-admin-secret"];
      if (provided !== secret) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const body = request.body as ProvisionBody;
      const { orgId, orgName, userId, email, name, grcRole } = body;

      if (!orgId || !userId || !email || !grcRole) {
        return reply.code(400).send({ error: "Missing required fields: orgId, userId, email, grcRole" });
      }

      if (!["AuditDirector", "ControlOwner"].includes(grcRole)) {
        return reply.code(400).send({ error: "grcRole must be AuditDirector or ControlOwner" });
      }

      const schema = tenantSchemaName(orgId as TenantId);
      const steps: string[] = [];

      try {
        // 1. Provision schema + tables
        await provisionTenantSchema(orgId as TenantId);
        steps.push("schema_provisioned");

        // 2. Upsert tenant row
        await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
          `INSERT INTO "${schema}".tenants (id, name, tier) VALUES ($1, $2, 'starter')
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
          orgId, orgName ?? orgId
        );
        steps.push("tenant_row_upserted");

        // 3. Upsert user
        await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
          `INSERT INTO "${schema}".users (id, email, name, active) VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, active = TRUE`,
          userId, email, name ?? email
        );
        steps.push("user_upserted");

        // 4. Upsert role assignment
        await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
          `INSERT INTO "${schema}".role_assignments (user_id, role) VALUES ($1, $2)
           ON CONFLICT (user_id, role, business_unit_id) DO NOTHING`,
          userId, grcRole
        );
        steps.push("role_assigned");

        fastify.log.info({ orgId, userId, schema, steps }, "Admin provision completed");
        return reply.code(200).send({ ok: true, schema, steps });
      } catch (err) {
        fastify.log.error({ orgId, userId, err, steps }, "Admin provision failed");
        return reply.code(500).send({ error: "Provisioning failed", steps, message: (err as Error).message });
      }
    }
  );
}
