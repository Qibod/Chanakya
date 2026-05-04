import type { FastifyInstance, FastifyRequest } from "fastify";
import { createClerkClient } from "@clerk/backend";
import { prisma, tenantSchemaName } from "@grc/db";
import { requireRole } from "../middleware/rbac.js";
import { authenticate } from "../middleware/auth.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import { redis } from "../plugins/redis.js";
import type { TenantId, UserRole } from "@grc/types";

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /v1/me — returns the current user's identity, role, and tenant tier
  fastify.get(
    "/v1/me",
    { preHandler: [authenticate, tenantMiddleware] },
    async (request) => {
      return {
        userId: request.user.userId,
        orgId: request.user.orgId,
        role: request.user.role,
        tier: request.tenant.tier,
      };
    }
  );

  // GET /v1/users — list all users in tenant with their roles (OrgAdmin only)
  fastify.get(
    "/v1/users",
    { preHandler: [authenticate, tenantMiddleware, requireRole("OrgAdmin")] },
    async (request) => {
      const schema = request.tenant.schemaName;
      const users = await (prisma.$queryRawUnsafe as (sql: string) => Promise<Array<{
        id: string; email: string; name: string; active: boolean; role: string | null;
      }>>)(
        `SELECT u.id, u.email, u.name, u.active, ra.role
         FROM "${schema}".users u
         LEFT JOIN "${schema}".role_assignments ra
           ON ra.user_id = u.id AND ra.business_unit_id IS NULL
         ORDER BY u.name ASC`
      );
      return { data: users };
    }
  );

  // PATCH /v1/users/:id — update a user's role (OrgAdmin only)
  fastify.patch(
    "/v1/users/:id",
    { preHandler: [authenticate, tenantMiddleware, requireRole("OrgAdmin")] },
    async (request, reply) => {
      const { id } = (request as FastifyRequest<{ Params: { id: string } }>).params;
      const { role } = (request as FastifyRequest<{ Body: { role: UserRole } }>).body;
      const tenantId = request.tenant.tenantId as TenantId;
      const schema = tenantSchemaName(tenantId);

      await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
        `INSERT INTO "${schema}".role_assignments (user_id, role)
         VALUES ($1, $2)
         ON CONFLICT (user_id) WHERE business_unit_id IS NULL
         DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`,
        id,
        role
      );

      await redis.del(`rbac:${tenantId}:${id}`);
      fastify.log.info({ tenantId, userId: id, role }, "User role updated");
      return reply.code(200).send({ data: { userId: id, role } });
    }
  );

  // DELETE /v1/users/:userId — deactivate a user (OrgAdmin only)
  fastify.delete(
    "/v1/users/:userId",
    { preHandler: [authenticate, tenantMiddleware, requireRole("OrgAdmin")] },
    async (request, reply) => {
      const { userId } = (request as FastifyRequest<{ Params: { userId: string } }>).params;
      const tenantId = request.tenant.tenantId as TenantId;
      const schema = tenantSchemaName(tenantId);

      const clerkClient = createClerkClient({
        secretKey: process.env["CLERK_SECRET_KEY"],
      });

      const sessions = await clerkClient.sessions.getSessionList({ userId, status: "active" });
      await Promise.all(sessions.data.map((s) => clerkClient.sessions.revokeSession(s.id)));

      await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
        `UPDATE "${schema}".users SET active = FALSE, updated_at = NOW() WHERE id = $1`,
        userId
      );

      await redis.del(`rbac:${tenantId}:${userId}`);
      fastify.log.info({ tenantId, userId }, "User deactivated");
      return reply.code(204).send();
    }
  );
}
