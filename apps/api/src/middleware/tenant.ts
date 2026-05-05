import type { FastifyRequest, FastifyReply } from "fastify";
import type { TenantContext, TenantId, SubscriptionTier, UserRole } from "@grc/types";
import { tenantSchemaName, prisma } from "@grc/db";

declare module "fastify" {
  interface FastifyRequest {
    tenant: TenantContext;
  }
}

/**
 * Populates request.tenant from the Clerk JWT org context (request.user.orgId)
 * and updates request.user.role with the value from role_assignments DB lookup.
 *
 * Must run AFTER authenticate middleware, which sets request.user.orgId.
 *
 * Returns 400 if orgId is absent (authenticate middleware did not run or no org context).
 *
 * TODO Story 1.6: cache tier + role in Redis (key: rbac:{tenantId}:{userId}, TTL 300s).
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = (request as unknown as { user?: { orgId?: string } }).user?.orgId;

  if (!tenantId) {
    return reply.code(400).send({
      error: {
        code: "TENANT_REQUIRED",
        message: "Tenant context missing",
      },
    });
  }

  const schema = tenantSchemaName(tenantId as TenantId);
  const userId = (request as unknown as { user?: { userId?: string } }).user?.userId ?? "";

  // NOTE: $queryRawUnsafe bypasses Prisma's search_path extension — schema must be
  // explicit in every query here. Prisma model methods (prisma.tenants.findFirst) do
  // NOT work across dynamic tenant schemas; raw SQL is intentional.
  const [tierRows, roleRows] = await Promise.all([
    (prisma.$queryRawUnsafe as (sql: string, ...args: unknown[]) => Promise<Array<{ tier: string }>>)(
      `SELECT tier FROM "${schema}".tenants WHERE id = $1 LIMIT 1`,
      tenantId
    ),
    (prisma.$queryRawUnsafe as (sql: string, ...args: unknown[]) => Promise<Array<{ role: string }>>)(
      `SELECT role FROM "${schema}".role_assignments WHERE user_id = $1 AND business_unit_id IS NULL ORDER BY created_at ASC LIMIT 1`,
      userId
    ),
  ]);

  if (!tierRows[0]) {
    return reply.code(503).send({
      error: {
        code: "TENANT_NOT_PROVISIONED",
        message: "Tenant schema not found — provisioning may still be in progress",
      },
    });
  }

  const tier = tierRows[0].tier as SubscriptionTier;
  const role = (roleRows[0]?.role ?? "ReadOnly") as UserRole;

  if (request.user) {
    request.user = { ...request.user, role };
  }

  request.tenant = {
    tenantId: tenantId as TenantId,
    tier,
    schemaName: schema,
  };
}
