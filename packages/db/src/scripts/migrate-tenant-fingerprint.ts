/* eslint-disable no-console -- CLI migration script */
/**
 * Upgrades `fingerprint_results` in existing tenant schemas when Story 2.1+ DDL
 * was applied after tenants were provisioned with an older template.
 *
 * Requires DATABASE_URL. Safe to re-run (idempotent columns / index; constraint added once).
 *
 * Usage: `pnpm --filter @grc/db db:migrate:tenant-fingerprint`
 */
import { prisma } from "../client.js";

const SCHEMA_PATTERN = /^tenant_[0-9a-f]{32}$/;

async function migrateFingerprintTable(schema: string): Promise<void> {
  if (!SCHEMA_PATTERN.test(schema)) {
    throw new Error(`Refusing unsafe schema name: ${schema}`);
  }

  const tableCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = ${schema}
        AND table_name = 'fingerprint_results'
    ) AS exists
  `;

  const exists = tableCheck[0]?.exists ?? false;

  if (!exists) {
    console.log(`[skip] ${schema}: no fingerprint_results table`);
    return;
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${schema}".fingerprint_results
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'queued',
      ADD COLUMN IF NOT EXISTS failure_reason TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS fingerprint_results_job_id_key
    ON "${schema}".fingerprint_results (job_id)
  `);

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "${schema}".fingerprint_results
        ADD CONSTRAINT fingerprint_results_status_check
        CHECK (status IN ('queued', 'pending_review', 'failed', 'committed'))
    `);
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code !== "42710") {
      throw e;
    }
    console.log(`[ok] ${schema}: status check constraint already present`);
  }

  console.log(`[ok] ${schema}: fingerprint_results upgraded`);
}

async function main(): Promise<void> {
  if (!process.env["DATABASE_URL"]) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const rows = await prisma.$queryRaw<Array<{ schema_name: string }>>`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
    ORDER BY schema_name
  `;

  const schemas = rows.map((r: { schema_name: string }) => r.schema_name).filter((s: string) => SCHEMA_PATTERN.test(s));

  if (schemas.length === 0) {
    console.log("No tenant_* schemas found.");
    return;
  }

  for (const schema of schemas) {
    await migrateFingerprintTable(schema);
  }

  console.log(`Done. Processed ${schemas.length} tenant schema(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
