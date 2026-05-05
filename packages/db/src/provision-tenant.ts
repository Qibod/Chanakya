import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Prisma } from "@prisma/client";
import type { TenantId } from "@grc/types";
import { prisma } from "./client.js";

// Accepts UUID-format or Clerk org ID format (org_[A-Za-z0-9]+)
const TENANT_ID_RE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|org_[A-Za-z0-9]+)$/i;

/**
 * Split a SQL string into individual statements on semicolons, while correctly
 * handling $$ dollar-quoted blocks (PL/pgSQL DO statements).
 * A naive .split(";") would break DO $$ BEGIN ... END $$; blocks at any
 * semicolon inside the block body.
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;

    // Detect $$ delimiter
    if (ch === "$" && sql[i + 1] === "$") {
      inDollarQuote = !inDollarQuote;
      current += "$$";
      i++; // skip second $
      continue;
    }

    if (ch === ";" && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = "";
    } else {
      current += ch;
    }
  }

  // Capture any trailing statement without a terminating semicolon
  const trimmed = current.trim();
  if (trimmed.length > 0) statements.push(trimmed);

  return statements;
}

export function tenantSchemaName(tenantId: TenantId): string {
  return `tenant_${tenantId.replace(/-/g, "")}`;
}

export async function provisionTenantSchema(tenantId: TenantId): Promise<void> {
  if (!TENANT_ID_RE.test(tenantId)) {
    throw new Error(`Invalid tenantId: ${tenantId}`);
  }
  const schema = tenantSchemaName(tenantId);
  const templateSql = readFileSync(
    join(__dirname, "migrations", "tenant-template.sql"),
    "utf-8"
  );

  // Split on statement-terminating semicolons while respecting $$-quoted
  // dollar-quote blocks (used by DO $$ BEGIN...END $$; PL/pgSQL statements).
  // A naive .split(";") would break DO blocks at internal semicolons.
  const statements = splitSqlStatements(
    templateSql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
  );

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
