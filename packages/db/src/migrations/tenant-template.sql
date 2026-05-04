-- Tenant schema template — applied to each new tenant schema (tenant_{uuid_no_hyphens})
-- Run via provisionTenantSchema() after: CREATE SCHEMA "tenant_{id}" + SET search_path
--
-- ARCH-2: Each tenant gets schema tenant_{uuid_no_hyphens}
-- ARCH-4: control_health_snapshots is append-only (data collected from day 1 — Time Machine UI in Phase 3)
-- ARCH-5: All BU-scoped tables include nullable business_unit_id (single-BU tenants use null)
-- ARCH-7: audit_access_tokens uses UUID v7 pattern (generated at application layer)

-- ---------------------------------------------------------------------------
-- 1. tenants — tenant metadata
-- ---------------------------------------------------------------------------
CREATE TABLE tenants (
    id          TEXT        NOT NULL,
    name        TEXT        NOT NULL,
    tier        TEXT        NOT NULL DEFAULT 'starter',
    region      TEXT        NOT NULL DEFAULT 'us-central1',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenants_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- 2. users — Clerk user profiles, synced via webhook (Story 1.3)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id          TEXT        NOT NULL,   -- Clerk user ID (e.g. user_abc123)
    email       TEXT        NOT NULL,
    name        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_pkey    PRIMARY KEY (id),
    CONSTRAINT users_email   UNIQUE (email)
);

-- ---------------------------------------------------------------------------
-- 3. role_assignments — BU-scoped (ARCH-5: nullable business_unit_id)
-- ---------------------------------------------------------------------------
CREATE TABLE role_assignments (
    id               TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    user_id          TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role             TEXT        NOT NULL,
    business_unit_id TEXT,                  -- nullable, ARCH-5
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT role_assignments_pkey   PRIMARY KEY (id),
    CONSTRAINT role_assignments_unique UNIQUE (user_id, role, business_unit_id)
);

-- ---------------------------------------------------------------------------
-- 4. framework_activations — active compliance frameworks
-- ---------------------------------------------------------------------------
CREATE TABLE framework_activations (
    id           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    framework    TEXT        NOT NULL,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_by TEXT        REFERENCES users(id),
    CONSTRAINT framework_activations_pkey       PRIMARY KEY (id),
    CONSTRAINT framework_activations_framework  UNIQUE (framework)
);

-- ---------------------------------------------------------------------------
-- 5. control_items — BU-scoped (ARCH-5: nullable business_unit_id)
-- ---------------------------------------------------------------------------
CREATE TABLE control_items (
    id               TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    framework        TEXT        NOT NULL,
    control_code     TEXT        NOT NULL,
    name             TEXT        NOT NULL,
    description      TEXT,
    status           TEXT        NOT NULL DEFAULT 'not_started',
    assigned_to      TEXT        REFERENCES users(id),
    business_unit_id TEXT,                  -- nullable, ARCH-5
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT control_items_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- 6. control_health_snapshots — append-only (ARCH-4)
--    Columns exactly as specified: (id, tenant_id, control_id, status, score, recorded_at)
-- ---------------------------------------------------------------------------
CREATE TABLE control_health_snapshots (
    id         TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
    tenant_id  TEXT           NOT NULL,
    control_id TEXT           NOT NULL REFERENCES control_items(id),
    status     TEXT           NOT NULL,         -- 'pass' | 'warn' | 'fail'
    score      DECIMAL(5, 2),
    recorded_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT control_health_snapshots_pkey PRIMARY KEY (id)
);

-- Append-only enforcement (ARCH-4)
REVOKE UPDATE, DELETE ON control_health_snapshots FROM PUBLIC;
GRANT SELECT, INSERT ON control_health_snapshots TO PUBLIC;

-- ---------------------------------------------------------------------------
-- 7. evidence_blobs — content-addressed (SHA-256); write-once
-- ---------------------------------------------------------------------------
CREATE TABLE evidence_blobs (
    id               TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    content_hash     TEXT        NOT NULL,   -- SHA-256 hex string
    storage_path     TEXT        NOT NULL,   -- gs://grc-evidence-{env}/{tenantId}/{id}
    file_size_bytes  BIGINT      NOT NULL,
    mime_type        TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT evidence_blobs_pkey         PRIMARY KEY (id),
    CONSTRAINT evidence_blobs_content_hash UNIQUE (content_hash)
);

-- ---------------------------------------------------------------------------
-- 8. evidence_items — mutable metadata; BU-scoped (ARCH-5)
-- ---------------------------------------------------------------------------
CREATE TABLE evidence_items (
    id               TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    control_item_id  TEXT        NOT NULL REFERENCES control_items(id),
    blob_id          TEXT        NOT NULL REFERENCES evidence_blobs(id),
    file_name        TEXT        NOT NULL,
    source           TEXT        NOT NULL,   -- 'manual' | 'okta' | 'aws' | 'salesforce' | 'jira' | 'api'
    source_system_ref TEXT,
    is_current       BOOLEAN     NOT NULL DEFAULT TRUE,
    collected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    business_unit_id TEXT,                  -- nullable, ARCH-5
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT evidence_items_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- 9. fingerprint_results — AI inference output (Story 2.x)
-- ---------------------------------------------------------------------------
CREATE TABLE fingerprint_results (
    id               TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    job_id           TEXT        NOT NULL,
    company_name     TEXT        NOT NULL,
    industry         TEXT,
    data             JSONB       NOT NULL DEFAULT '{}',
    confidence_scores JSONB,
    confirmed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fingerprint_results_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- 10. audit_engagements — BU-scoped (ARCH-5)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_engagements (
    id                  TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    title               TEXT        NOT NULL,
    framework           TEXT        NOT NULL,
    status              TEXT        NOT NULL DEFAULT 'draft',
    scope_confirmed_at  TIMESTAMPTZ,
    scope_confirmed_by  TEXT        REFERENCES users(id),
    business_unit_id    TEXT,               -- nullable, ARCH-5
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT audit_engagements_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- 11. audit_access_tokens — external auditor tokens (ARCH-7)
--     UUID v7 generated at application layer; stored as TEXT
-- ---------------------------------------------------------------------------
CREATE TABLE audit_access_tokens (
    id                TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    audit_id          TEXT        NOT NULL REFERENCES audit_engagements(id),
    scoped_control_ids TEXT[]     NOT NULL DEFAULT '{}',
    created_by        TEXT        NOT NULL REFERENCES users(id),
    expires_at        TIMESTAMPTZ NOT NULL,
    revoked_at        TIMESTAMPTZ,
    last_used_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT audit_access_tokens_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- 12. risk_items — BU-scoped (ARCH-5)
-- ---------------------------------------------------------------------------
CREATE TABLE risk_items (
    id               TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    title            TEXT        NOT NULL,
    description      TEXT,
    likelihood       TEXT,
    impact           TEXT,
    status           TEXT        NOT NULL DEFAULT 'open',
    owner_id         TEXT        REFERENCES users(id),
    business_unit_id TEXT,                  -- nullable, ARCH-5
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT risk_items_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- 13. findings — audit findings; BU-scoped (ARCH-5)
-- ---------------------------------------------------------------------------
CREATE TABLE findings (
    id               TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    audit_id         TEXT        NOT NULL REFERENCES audit_engagements(id),
    control_item_id  TEXT        REFERENCES control_items(id),
    title            TEXT        NOT NULL,
    description      TEXT,
    severity         TEXT        NOT NULL DEFAULT 'medium',
    status           TEXT        NOT NULL DEFAULT 'open',
    owner_id         TEXT        REFERENCES users(id),
    due_date         DATE,
    business_unit_id TEXT,                  -- nullable, ARCH-5
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT findings_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- 14. integration_configs — BU-scoped (ARCH-5)
-- ---------------------------------------------------------------------------
CREATE TABLE integration_configs (
    id               TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    provider         TEXT        NOT NULL,   -- 'okta' | 'aws' | 'salesforce' | 'jira'
    status           TEXT        NOT NULL DEFAULT 'disconnected',
    config           JSONB       NOT NULL DEFAULT '{}',
    last_synced_at   TIMESTAMPTZ,
    business_unit_id TEXT,                  -- nullable, ARCH-5
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT integration_configs_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_control_items_status      ON control_items(status);
CREATE INDEX idx_control_items_framework   ON control_items(framework);
CREATE INDEX idx_control_items_assigned_to ON control_items(assigned_to);

CREATE INDEX idx_evidence_items_control    ON evidence_items(control_item_id);
CREATE INDEX idx_evidence_items_current    ON evidence_items(control_item_id, is_current);
CREATE INDEX idx_evidence_blobs_hash       ON evidence_blobs(content_hash);

CREATE INDEX idx_control_health_control_time ON control_health_snapshots(control_id, recorded_at);
CREATE INDEX idx_control_health_tenant_time  ON control_health_snapshots(tenant_id, recorded_at);

CREATE INDEX idx_audit_access_tokens_audit   ON audit_access_tokens(audit_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_audit_access_tokens_expires ON audit_access_tokens(expires_at) WHERE revoked_at IS NULL;

CREATE INDEX idx_risk_items_status  ON risk_items(status);
CREATE INDEX idx_findings_audit     ON findings(audit_id);
CREATE INDEX idx_findings_status    ON findings(status);
