import type { FastifyRequest, FastifyReply } from "fastify";
import type { TenantContext, TenantId } from "@grc/types";
import { tenantSchemaName } from "@grc/db";

// Augment Fastify's Request type so every handler has request.tenant
declare module "fastify" {
  interface FastifyRequest {
    tenant: TenantContext;
  }
}

// Simple UUID v4 format check (sufficient for tenant ID validation)
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Populates request.tenant from the validated tenant context.
 *
 * Story 1.2 (dev stub): reads tenantId from x-tenant-id header.
 * TODO Story 1.3: replace with JWT-based tenant resolution from Clerk session.
 *                 The x-tenant-id header must NOT be trusted in production.
 *
 * Returns 400 if tenantId is absent or not a valid UUID.
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // TODO Story 1.3: extract tenantId from Clerk JWT claims, not from header
  const raw = request.headers["x-tenant-id"];
  const tenantId = Array.isArray(raw) ? raw[0] : raw;

  if (!tenantId || !UUID_RE.test(tenantId)) {
    return reply.code(400).send({
      error: {
        code: "TENANT_REQUIRED",
        message: "Valid tenant context is required",
      },
    });
  }

  request.tenant = {
    tenantId: tenantId as TenantId,
    tier: "starter", // TODO Story 1.3: read from JWT / DB
    schemaName: tenantSchemaName(tenantId as TenantId),
  };
}
