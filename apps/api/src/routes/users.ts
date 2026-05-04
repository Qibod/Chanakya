import type { FastifyInstance, FastifyRequest } from "fastify";
import { createClerkClient } from "@clerk/backend";
import { prisma, tenantSchemaName } from "@grc/db";
import { requireRole } from "../middleware/rbac.js";
import { authenticate } from "../middleware/auth.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import { redis } from "../plugins/redis.js";
import type { TenantId } from "@grc/types";

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.delete(
    "/v1/users/:userId",
    {
      preHandler: [authenticate, tenantMiddleware, requireRole("OrgAdmin")],
    },
    async (request, reply) => {
      const { userId } = (request as FastifyRequest<{ Params: { userId: string } }>).params;
      const tenantId = request.tenant.tenantId as TenantId;
      const schema = tenantSchemaName(tenantId);

      const clerkClient = createClerkClient({
        secretKey: process.env["CLERK_SECRET_KEY"],
      });

      // Revoke all active Clerk sessions for the user
      const sessions = await clerkClient.sessions.getSessionList({ userId, status: "active" });
      await Promise.all(sessions.data.map((s) => clerkClient.sessions.revokeSession(s.id)));

      // Mark user inactive locally
      await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
        `UPDATE "${schema}".users SET active = FALSE, updated_at = NOW() WHERE id = $1`,
        userId
      );

      // Flush Redis session cache
      await redis.del(`rbac:${tenantId}:${userId}`);

      fastify.log.info({ tenantId, userId }, "User deactivated");
      return reply.code(204).send();
    }
  );
}
