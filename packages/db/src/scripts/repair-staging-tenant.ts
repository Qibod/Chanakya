/**
 * One-shot repair script for staging: provisions a tenant schema + seeds sample
 * control items so the dashboard shows real data.
 *
 * Usage:
 *   DATABASE_URL=<staging-db-url> pnpm tsx src/scripts/repair-staging-tenant.ts \
 *     --org-id  <clerk-org-id>   \
 *     --org-name <org-name>      \
 *     --user-id <clerk-user-id>  \
 *     --email   <user-email>     \
 *     --name    "<First Last>"
 */
import { provisionTenantSchema, tenantSchemaName } from "../provision-tenant.js";
import { prisma } from "../client.js";
import type { TenantId } from "@grc/types";

function arg(flag: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) {
    throw new Error(`Missing required argument: ${flag}`);
  }
  return process.argv[idx + 1]!;
}

async function main() {
  const orgId = arg("--org-id") as TenantId;
  const orgName = arg("--org-name");
  const userId = arg("--user-id");
  const email = arg("--email");
  const name = arg("--name");

  const schema = tenantSchemaName(orgId);
  console.log(`Provisioning tenant schema: ${schema}`);

  await provisionTenantSchema(orgId);
  console.log("Schema provisioned.");

  const exec = prisma.$executeRawUnsafe as (sql: string, ...a: unknown[]) => Promise<number>;

  // Insert tenant row
  await exec(
    `INSERT INTO "${schema}".tenants (id, name, tier) VALUES ($1, $2, 'starter') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    orgId,
    orgName
  );
  console.log("Tenant row inserted.");

  // Insert user
  await exec(
    `INSERT INTO "${schema}".users (id, email, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, updated_at = NOW()`,
    userId,
    email,
    name
  );
  console.log("User inserted.");

  // Assign AuditDirector
  await exec(
    `INSERT INTO "${schema}".role_assignments (user_id, role) SELECT $1, 'AuditDirector' WHERE NOT EXISTS (SELECT 1 FROM "${schema}".role_assignments WHERE user_id = $1 AND business_unit_id IS NULL)`,
    userId
  );
  console.log("AuditDirector role assigned.");

  // user_tenant_map in public schema
  await exec(
    `INSERT INTO public.user_tenant_map (user_id, tenant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    userId,
    orgId
  );

  // Seed sample control items
  const controls: Array<{ canonicalId: string; framework: string; code: string; domain: string; name: string; status: string }> = [
    { canonicalId: "soc2-cc1.1", framework: "SOC 2", code: "CC1.1", domain: "Access Control", name: "MFA enforcement", status: "pass" },
    { canonicalId: "soc2-cc1.2", framework: "SOC 2", code: "CC1.2", domain: "Access Control", name: "Privileged access review", status: "warn" },
    { canonicalId: "soc2-cc2.1", framework: "SOC 2", code: "CC2.1", domain: "Monitoring", name: "Log aggregation & alerting", status: "fail" },
    { canonicalId: "soc2-cc2.2", framework: "SOC 2", code: "CC2.2", domain: "Monitoring", name: "Security incident response plan", status: "pass" },
    { canonicalId: "soc2-cc3.1", framework: "SOC 2", code: "CC3.1", domain: "Risk Assessment", name: "Annual risk assessment", status: "pass" },
    { canonicalId: "soc2-cc3.2", framework: "SOC 2", code: "CC3.2", domain: "Risk Assessment", name: "Vendor risk reviews", status: "warn" },
    { canonicalId: "soc2-cc4.1", framework: "SOC 2", code: "CC4.1", domain: "Change Management", name: "Code review policy", status: "pass" },
    { canonicalId: "soc2-cc4.2", framework: "SOC 2", code: "CC4.2", domain: "Change Management", name: "Deployment approval workflow", status: "pass" },
    { canonicalId: "soc2-cc5.1", framework: "SOC 2", code: "CC5.1", domain: "Data Protection", name: "Encryption at rest", status: "pass" },
    { canonicalId: "soc2-cc5.2", framework: "SOC 2", code: "CC5.2", domain: "Data Protection", name: "Encryption in transit", status: "pass" },
    { canonicalId: "soc2-cc5.3", framework: "SOC 2", code: "CC5.3", domain: "Data Protection", name: "Data retention policy", status: "warn" },
    { canonicalId: "soc2-cc6.1", framework: "SOC 2", code: "CC6.1", domain: "Business Continuity", name: "Backup & restore testing", status: "fail" },
  ];

  for (const c of controls) {
    await exec(
      `INSERT INTO "${schema}".control_items (canonical_id, framework, control_code, framework_refs, domain, name, status)
       VALUES ($1, $2, $3, '[]'::jsonb, $4, $5, $6)
       ON CONFLICT (canonical_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
      c.canonicalId, c.framework, c.code, c.domain, c.name, c.status
    );
  }
  console.log(`Seeded ${controls.length} control items.`);

  console.log("\nDone! Tenant is ready. Summary:");
  console.log(`  Org ID:  ${orgId}`);
  console.log(`  Schema:  ${schema}`);
  console.log(`  User:    ${userId} (${email}) — AuditDirector`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
