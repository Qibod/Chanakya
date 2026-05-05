-- Story 2.4: extend existing tenant schemas created before canonical_id / framework_refs.
-- Run per tenant schema (replace TENANT_SCHEMA). New provisions use tenant-template.sql only.

ALTER TABLE "TENANT_SCHEMA".control_items
  ADD COLUMN IF NOT EXISTS canonical_id TEXT,
  ADD COLUMN IF NOT EXISTS framework_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS domain TEXT;

UPDATE "TENANT_SCHEMA".control_items
SET
  canonical_id = COALESCE(canonical_id, 'legacy-' || id),
  domain = COALESCE(domain, 'General'),
  framework_refs = CASE
    WHEN framework_refs = '[]'::jsonb OR framework_refs IS NULL
    THEN jsonb_build_array(framework || ':' || control_code)
    ELSE framework_refs
  END
WHERE canonical_id IS NULL OR domain IS NULL;

ALTER TABLE "TENANT_SCHEMA".control_items
  ALTER COLUMN canonical_id SET NOT NULL,
  ALTER COLUMN domain SET NOT NULL;

ALTER TABLE "TENANT_SCHEMA".control_items
  ADD CONSTRAINT control_items_canonical_unique UNIQUE (canonical_id);

ALTER TABLE "TENANT_SCHEMA".control_items
  ALTER COLUMN status SET DEFAULT 'pending';

UPDATE "TENANT_SCHEMA".control_items
SET status = 'pending'
WHERE status = 'not_started';

-- Optional: query-by-ref performance (Story 2.4 review)
-- CREATE INDEX IF NOT EXISTS idx_control_items_framework_refs_gin
--   ON "TENANT_SCHEMA".control_items USING GIN (framework_refs);
