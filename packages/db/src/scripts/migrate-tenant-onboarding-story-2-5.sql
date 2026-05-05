-- Story 2.5 — Add onboarding columns on tenants + integration status constraint (existing tenant schemas).
-- Replace TENANT_SCHEMA with your tenant schema name, e.g. tenant_aabbccddeeff00112233445566778899

ALTER TABLE "TENANT_SCHEMA".tenants
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_first_report_completed_at TIMESTAMPTZ;

-- Optional: add CHECK on integration_configs.status if the table exists without it (skip if already present).
-- ALTER TABLE "TENANT_SCHEMA".integration_configs DROP CONSTRAINT IF EXISTS integration_configs_status_check;
-- ALTER TABLE "TENANT_SCHEMA".integration_configs ADD CONSTRAINT integration_configs_status_check
--   CHECK (status IN ('disconnected', 'connected', 'pending', 'error'));
