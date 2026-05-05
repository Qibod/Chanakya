import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Prisma } from "@prisma/client";
import type { TenantId } from "@grc/types";
import { prisma } from "./client.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function tenantSchemaName(tenantId: TenantId): string {
  return `tenant_${tenantId.replace(/-/g, "")}`;
}

export async function provisionTenantSchema(tenantId: TenantId): Promise<void> {
  if (!UUID_RE.test(tenantId)) {
    throw new Error(`Invalid tenantId: ${tenantId}`);
  }
  const schema = tenantSchemaName(tenantId);
  const templateSql = readFileSync(
    join(__dirname, "migrations", "tenant-template.sql"),
    "utf-8"
  );

  // Strip comment lines first so semicolons inside comments don't cause splits,
  // then split on statement-terminating semicolons.
  const statements = templateSql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${schema}"`
    );
    await tx.$executeRawUnsafe(`SET LOCAL search_path = "${schema}", public`);
    for (const stmt of statements) {
      await tx.$executeRawUnsafe(stmt);
    }
  });
}
