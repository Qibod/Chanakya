import type { FastifyInstance, FastifyRequest } from "fastify";
import { createClerkClient } from "@clerk/backend";
import { prisma, tenantSchemaName } from "@grc/db";
import { requireRole } from "../middleware/rbac.js";
import { authenticate } from "../middleware/auth.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import { redis } from "../plugins/redis.js";
import { rbacCacheKey } from "./webhooks/clerk.js";
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

  // GET /v1/users — paginated list of users in tenant with their roles (AuditDirector+)
  fastify.get(
    "/v1/users",
    { preHandler: [authenticate, tenantMiddleware, requireRole("AuditDirector")] },
    async (request) => {
      const schema = request.tenant.schemaName;
      const q = (
        request as FastifyRequest<{ Querystring: { limit?: string; offset?: string; role?: string } }>
      ).query;
      const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 100);
      const offset = Math.max(Number(q.offset ?? 0), 0);
      const roleFilter = typeof q.role === "string" && q.role.length > 0 ? q.role : null;

      const [users, countRows] = await Promise.all([
        (prisma.$queryRawUnsafe as (sql: string, ...args: unknown[]) => Promise<Array<{
          id: string; email: string; name: string; active: boolean; role: string | null;
        }>>)(
          `SELECT u.id, u.email, u.name, u.active, ra.role
           FROM "${schema}".users u
           LEFT JOIN "${schema}".role_assignments ra
             ON ra.user_id = u.id AND ra.business_unit_id IS NULL
           ${roleFilter ? "WHERE ra.role = $3" : ""}
           ORDER BY u.name ASC
           LIMIT $1 OFFSET $2`,
          limit,
          offset,
          ...(roleFilter ? [roleFilter] : [])
        ),
        (prisma.$queryRawUnsafe as (sql: string, ...args: unknown[]) => Promise<Array<{ count: string }>>)(
          roleFilter
            ? `SELECT COUNT(*)::text AS count
               FROM "${schema}".users u
               LEFT JOIN "${schema}".role_assignments ra
                 ON ra.user_id = u.id AND ra.business_unit_id IS NULL
               WHERE ra.role = $1`
            : `SELECT COUNT(*)::text AS count FROM "${schema}".users`,
          ...(roleFilter ? [roleFilter] : [])
        ),
      ]);

      return {
        data: users,
        pagination: { limit, offset, total: Number(countRows[0]?.count ?? 0) },
      };
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

      await redis.del(rbacCacheKey(tenantId, id));
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

      await redis.del(rbacCacheKey(tenantId, userId));
      fastify.log.info({ tenantId, userId }, "User deactivated");
      return reply.code(204).send();
    }
  );
}
