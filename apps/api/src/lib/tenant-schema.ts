import type { FastifyReply } from "fastify";

/** Defense-in-depth before interpolating tenant schema into raw SQL. */
const TENANT_SCHEMA_NAME_RE = /^[a-z_][a-z0-9_]{0,62}$/i;

export function ensureTenantSchemaNameOrReply(reply: FastifyReply, schema: string): boolean {
  if (TENANT_SCHEMA_NAME_RE.test(schema)) return true;
  reply.code(500).send({
    error: {
      code: "INVALID_SCHEMA_NAME",
      message: "Tenant schema identifier rejected",
    },
  });
  return false;
}

