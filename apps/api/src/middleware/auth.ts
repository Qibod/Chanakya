import type { FastifyRequest, FastifyReply } from "fastify";
import { getAuth } from "@clerk/fastify";
import type { UserContext, UserRole } from "@grc/types";

declare module "fastify" {
  interface FastifyRequest {
    user: UserContext;
  }
}

/**
 * Verifies the Clerk session JWT and populates request.user.
 * Must run before tenantMiddleware (which overwrites request.user.role with DB value).
 *
 * Returns 401 if:
 * - No active Clerk session
 * - Session has no orgId (user must be in an organisation context)
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const auth = getAuth(request);

  if (!auth.userId || !auth.orgId) {
    return reply.code(401).send({
      error: { code: "UNAUTHENTICATED", message: "Valid session required" },
    });
  }

  // role is a safe default — overwritten by tenantMiddleware DB lookup.
  // ReadOnly ensures fail-closed if tenantMiddleware is skipped on a misconfigured route.
  request.user = {
    userId: auth.userId,
    orgId: auth.orgId,
    role: "ReadOnly" as UserRole,
    sessionId: auth.sessionId ?? "",
  };
}
