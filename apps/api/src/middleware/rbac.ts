import type { FastifyRequest, FastifyReply } from "fastify";
import { ROLE_SATISFIES, TIER_ORDER } from "@grc/types";
import type { UserRole, SubscriptionTier } from "@grc/types";

/**
 * Route preHandler factory: requires the user's role to satisfy the given role.
 * Usage: fastify.get('/v1/route', { preHandler: [authenticate, tenantMiddleware, requireRole('AuditDirector')] }, handler)
 *
 * Returns 403 if the user's role does not satisfy the required role.
 * Never includes the user's actual role or the required role in the error response.
 */
export function requireRole(role: UserRole) {
  return async function roleGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userRole = request.user?.role;
    if (!userRole || !ROLE_SATISFIES[userRole]?.includes(role)) {
      return reply.code(403).send({
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }
  };
}

/**
 * Route preHandler factory: requires the tenant's subscription tier to meet the minimum.
 * Returns 402 if the tenant's tier is below the required tier.
 */
export function requireTier(tier: SubscriptionTier) {
  return async function tierGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const tenantTier = request.tenant?.tier;
    if (!tenantTier || TIER_ORDER[tenantTier] < TIER_ORDER[tier]) {
      return reply.code(402).send({
        error: { code: "TIER_LIMIT_EXCEEDED", message: "Feature requires higher tier" },
      });
    }
  };
}
