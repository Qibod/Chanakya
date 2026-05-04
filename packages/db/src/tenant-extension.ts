import type { PrismaClient } from "@prisma/client";
import type { TenantId } from "@grc/types";
import { tenantSchemaName } from "./provision-tenant.js";

/**
 * Returns a Prisma client scoped to the given tenant's PostgreSQL schema.
 *
 * Every operation is wrapped in a transaction that issues
 * SET LOCAL search_path = "tenant_{id}", public
 * before the query, ensuring complete schema isolation.
 *
 * ARCH-2: tenant ID comes from request.tenant — never from client headers.
 *
 * Usage:
 *   const db = createTenantClient(prisma, request.tenant.tenantId);
 *   const controls = await db.controlItem.findMany();
 */
export function createTenantClient(basePrisma: PrismaClient, tenantId: TenantId) {
  const schema = tenantSchemaName(tenantId);

  return basePrisma.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({
          args,
          query,
        }: {
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          // basePrisma.$transaction (array syntax) runs both promises in the same DB transaction:
          //   [0] SET LOCAL search_path — applies only within this transaction (safe for connection pools)
          //   [1] query(args) — the underlying Prisma operation, bypasses the extension chain (no recursion)
          const [, result] = await basePrisma.$transaction([
            basePrisma.$executeRawUnsafe(
              `SET LOCAL search_path = "${schema}", public`
            ),
            query(args) as ReturnType<typeof basePrisma.$executeRawUnsafe>,
          ]);
          return result;
        },
      },
    },
  });
}
