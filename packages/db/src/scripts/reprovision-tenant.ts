/**
 * One-off script to re-provision a tenant schema when the initial
 * Clerk webhook failed (e.g. due to the DO $$ splitter bug fixed 2026-05-05).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." pnpm tsx packages/db/src/scripts/reprovision-tenant.ts <orgId> "<org name>"
 *
 * Example:
 *   DATABASE_URL="..." pnpm tsx packages/db/src/scripts/reprovision-tenant.ts org_3DJfRv2PJKBRmi41QXYWPQfeBSu "Chanakya Demo"
 *
 * Safe to re-run — uses CREATE TABLE IF NOT EXISTS and ON CONFLICT DO NOTHING throughout.
 */
import { provisionTenantSchema, tenantSchemaName } from "../provision-tenant.js";
import { prisma } from "../client.js";
import type { TenantId } from "@grc/types";

const [tenantId, orgName] = process.argv.slice(2) as [string, string];

if (!tenantId) {
  console.error("Usage: reprovision-tenant.ts <orgId> [orgName]");
  process.exit(1);
}

const schema = tenantSchemaName(tenantId as TenantId);

console.log(`Re-provisioning tenant schema "${schema}" for org "${tenantId}"...`);

try {
  await provisionTenantSchema(tenantId as TenantId);
  console.log("✅ Schema provisioned (tables created)");

  // Upsert the tenant row
  await (prisma.$executeRawUnsafe as (sql: string, ...args: unknown[]) => Promise<number>)(
    `INSERT INTO "${schema}".tenants (id, name, tier) VALUES ($1, $2, 'starter') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    tenantId,
    orgName ?? tenantId
  );
  console.log("✅ Tenant row upserted");

  console.log("\n✅ Done. Tenant is ready — reload the dashboard.");
} catch (err) {
  console.error("❌ Provisioning failed:", err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
