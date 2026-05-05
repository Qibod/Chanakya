-- Story 3.3 — Add control_assignments table for existing tenant schemas.
-- Run per tenant schema (replace TENANT_SCHEMA). New provisions use tenant-template.sql only.
--
-- Safe to re-run (idempotent).

-- Create table if missing (older tenants).
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".control_assignments (
    id                    TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    control_item_id        TEXT        NOT NULL REFERENCES "TENANT_SCHEMA".control_items(id) ON DELETE CASCADE,
    assigned_to            TEXT        NOT NULL REFERENCES "TENANT_SCHEMA".users(id),
    assigned_by            TEXT        NOT NULL REFERENCES "TENANT_SCHEMA".users(id),
    due_date               DATE,
    instruction            TEXT        NOT NULL,
    instruction_model      TEXT        NOT NULL,
    instruction_context    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    instruction_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_current             BOOLEAN     NOT NULL DEFAULT TRUE,
    business_unit_id       TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT control_assignments_pkey PRIMARY KEY (id)
);

-- Ensure column set is complete (in case a partial table exists).
ALTER TABLE "TENANT_SCHEMA".control_assignments
  ADD COLUMN IF NOT EXISTS instruction_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS instruction_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS business_unit_id TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Enforce single current assignment per control (history preserved).
CREATE UNIQUE INDEX IF NOT EXISTS control_assignments_one_current_per_control
ON "TENANT_SCHEMA".control_assignments(control_item_id)
WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_control_assignments_assigned_to
  ON "TENANT_SCHEMA".control_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_control_assignments_control_item_id
  ON "TENANT_SCHEMA".control_assignments(control_item_id);
CREATE INDEX IF NOT EXISTS idx_control_assignments_is_current
  ON "TENANT_SCHEMA".control_assignments(control_item_id, is_current);

