# Story 4.1: Evidence Ingestion Pipeline — SHA-256 Integrity & Immutable Storage

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform engineer,  
I want every piece of evidence to be cryptographically hashed and stored immutably on ingest,  
so that evidence integrity can be verified by external auditors and cannot be tampered with after collection.

## Acceptance Criteria

1. **Given** any evidence bytes enter the ingestion pipeline (manual text note from `/my-tasks`, future integration/API paths must call the same pipeline)  
   **When** the pipeline runs  
   **Then** a **SHA-256** hash of the raw content is computed **before** any durable write (object storage or DB blob row)  
   **And** a deduplication lookup runs: `SELECT id FROM evidence_blobs WHERE content_hash = $hash` (equivalent to the epics’ `SELECT 1 …` check) **before** any upload  
   **And** on **miss**: the content is written to **Google Cloud Storage** using a tenant-scoped object key, with **Object Retention / bucket WORM policy** enabled for production (see Dev Notes for local/staging fallback)  
   **Then** a new `evidence_blobs` row is inserted (`content_hash`, `storage_path`, `file_size_bytes`, `mime_type`) and a new `evidence_items` row references that `blob_id`

2. **Given** the same content hash is ingested again for a different `evidence_items` row  
   **When** the pipeline runs  
   **Then** **no second upload** of identical bytes occurs  
   **And** a new `evidence_items` row points at the **existing** `evidence_blobs` row

3. **Given** a consumer requests **download or export** of blob bytes for an evidence item  
   **When** bytes are read from GCS and streamed/served  
   **Then** the SHA-256 of the streamed content is recomputed and **must equal** `evidence_blobs.content_hash`  
   **And** on mismatch the operation **fails** with an integrity error (`EVIDENCE_INTEGRITY_FAILURE` or similar), **no partial success**, and the failure is **logged** to `platform_audit_logs` (plus Sentry in API paths)

4. **Given** `evidence_blobs` is a write-once table  
   **When** database permissions are inspected for the tenant schema  
   **Then** **`UPDATE` and `DELETE` are revoked** from `app_role` / `PUBLIC` on `evidence_blobs` (same pattern as `control_health_snapshots` and public `platform_audit_logs`)  
   **And** any application attempt to mutate/delete blob rows must not be part of normal code paths (dedupe must **not** use `ON CONFLICT … DO UPDATE` on `evidence_blobs`)

5. **Given** a forbidden mutation of `evidence_blobs` is attempted (or integrity verification fails)  
   **When** the platform records the event  
   **Then** an entry is written to **`platform_audit_logs`** with actor, tenant, action, resource type/id, and IP where available

## Tasks / Subtasks

- [x] **Task 1 — Shared ingestion module (API + future worker)** (AC: #1, #2, #4)  
  - [x] Introduce a workspace package (recommended: `packages/evidence-ingestion` or `packages/evidence`) that exports a single orchestration function, e.g. `ingestEvidenceBlob({ prisma, schemaName, tenantId, controlItemId, bytes, fileName, mimeType, source, sourceSystemRef, businessUnitId? }) → { blobId, evidenceItemId, deduped }`.  
  - [x] Implement **streaming/hash** using Node `crypto.createHash("sha256")` (do not load multi-GB files fully into RAM if you extend to files later; for MVP bytes/buffers from my-tasks, buffer is OK).  
  - [x] Implement **dedupe**: `SELECT id FROM "{schema}".evidence_blobs WHERE content_hash = $hash` before upload.  
  - [x] Implement **GCS write** on miss: `@google-cloud/storage`, path shape consistent with template comment `gs://grc-evidence-{env}/{tenantId}/{id}` (store exact `gs://…` string in `storage_path`).  
  - [x] Insert `evidence_items` **after** blob row exists; preserve existing columns: `source`, `source_system_ref`, `is_current`, `business_unit_id`.  
  - [x] **Remove** the anti-pattern in [`apps/api/src/routes/v1/my-tasks.ts`](../../../apps/api/src/routes/v1/my-tasks.ts): `ON CONFLICT (content_hash) DO UPDATE` on `evidence_blobs` — replace with dedupe + insert only.

- [x] **Task 2 — Tenant template: immutability grants** (AC: #4, #5)  
  - [x] Update [`packages/db/src/migrations/tenant-template.sql`](../../../packages/db/src/migrations/tenant-template.sql): after `CREATE TABLE evidence_blobs`, add `REVOKE UPDATE, DELETE ON evidence_blobs FROM PUBLIC;` and `GRANT SELECT, INSERT ON evidence_blobs TO app_role;` (mirror `control_health_snapshots` block).  
  - [x] Ensure **`evidence_items`** remains mutable (metadata/versioning in later stories) — do not revoke updates there.  
  - [x] Update [`packages/db/src/tenant-template.test.ts`](../../../packages/db/src/tenant-template.test.ts) if it asserts grant text; add a test that `evidence_blobs` has no UPDATE/DELETE for `PUBLIC` (same pattern as `control_health_snapshots` in [`apps/api/tests/integration/tenant-isolation.test.ts`](../../../apps/api/tests/integration/tenant-isolation.test.ts)).

- [x] **Task 3 — Verified download / export hook** (AC: #3, #5)  
  - [x] Add a service helper `verifyAndReadBlob` / `openVerifiedReadStream` used by a minimal authenticated API route, e.g. `GET /v1/evidence-items/:evidenceItemId/download` (or `…/content`), RBAC: **OrgAdmin | AuditDirector | ControlOwner (only if assigned to that control)** — align with future Evidence tab.  
  - [x] Stream from GCS, hash while streaming, compare to `content_hash`; on failure log `platform_audit_logs` + return 500/409 with `{ error: { code: "EVIDENCE_INTEGRITY_FAILURE", message } }`.  
  - [x] Document that Story 5.x ZIP/report export must call the same helper (no duplicate verification logic).

- [x] **Task 4 — Config & environments** (AC: #1, #3)  
  - [x] Document env vars: `GCS_EVIDENCE_BUCKET`, `GCP_PROJECT_ID` (or workload identity), optional `GCS_EMULATOR_HOST` for local dev.  
  - [x] Production: bucket retention / object lock policy via Terraform (if `infra/` exists, add or stub); staging/local may omit lock but must still write real objects when integration tests run with GCS.

- [x] **Task 5 — Tests** (AC: all)  
  - [x] Unit tests: hash stability, dedupe branch (second ingest no upload — mock GCS).  
  - [x] API tests: my-tasks completion still works; integrity failure path returns structured error.  
  - [x] Integration (optional): `RUN_DB_INTEGRATION=true` asserts `evidence_blobs` grants.

## Dev Notes

### Story source of truth

- Epics: [`_bmad-output/planning-artifacts/epics.md`](../planning-artifacts/epics.md) → **Epic 4** → **Story 4.1**
- Architecture: [`_bmad-output/planning-artifacts/architecture.md`](../planning-artifacts/architecture.md) — Evidence Deduplication, Evidence immutability guard, GCS + Object Retention Lock, `packages/db` tenant schema
- PRD: [`_bmad-output/planning-artifacts/prd.md`](../planning-artifacts/prd.md) — FR15, Evidence Architecture (immutable blobs + mutable metadata)
- UX: [`_bmad-output/planning-artifacts/ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) — `EvidenceRow` hash indicator (full UI in Story 4.2; this story supplies trustworthy hash + storage)

### What exists today (read before changing anything)

- **Tenant DDL** already defines `evidence_blobs` / `evidence_items`: [`packages/db/src/migrations/tenant-template.sql`](../../../packages/db/src/migrations/tenant-template.sql) (`content_hash` **UNIQUE**, `storage_path` comment shows expected `gs://…` pattern).  
- **`evidence_blobs` append-only grants** are in [`packages/db/src/migrations/tenant-template.sql`](../../../packages/db/src/migrations/tenant-template.sql) (new tenants only — existing tenant schemas need a manual migration if already provisioned).  
- **Control owner completion** uses [`@grc/evidence-ingestion`](../../../packages/evidence-ingestion) `submitControlOwnerNoteEvidence` from [`apps/api/src/routes/v1/my-tasks.ts`](../../../apps/api/src/routes/v1/my-tasks.ts) (SHA-256 + dedupe + GCS or dev memory).  
- **Worker** [`apps/worker/src/index.ts`](../../../apps/worker/src/index.ts) only handles `fingerprint` jobs today; [`apps/worker/src/jobs/evidence-sync.job.ts`](../../../apps/worker/src/jobs/evidence-sync.job.ts) is a stub for **Story 4.5** — do not fully implement sync here, but **design** the ingestion package so `evidence-sync` can call it later.  
- **Types** [`packages/types/src/evidence.ts`](../../../packages/types/src/evidence.ts): partial `EvidenceItem` type; Zod upload schema deferred to Story 4.7 — add only what 4.1 needs (e.g. internal ingest DTO types) without bloating scope.

### Previous story intelligence (Epic 3 → 4 handoff)

- Story **3.4** established `POST /v1/my-tasks/:controlId/complete` and minimal evidence persistence for D4 UX — see [`_bmad-output/implementation-artifacts/3-4-control-owner-d4-clarity-first-view-my-tasks.md`](./3-4-control-owner-d4-clarity-first-view-my-tasks.md).  
- **Do not** break: assignee check, `{ data: … }` envelope, role gating, or `control_owner_task_completions` uniqueness on `assignment_id`.

### Architecture guardrails (non-negotiable)

- **Tenant isolation**: `request.tenant` / `schemaName` from middleware — never trust client-supplied tenant IDs.  
- **API envelope**: `{ data: T }` / `{ error: { code, message, details? } }`.  
- **Immutability**: no updates to blob bytes; dedupe via **reference** to existing `evidence_blobs` row, not `UPSERT` that touches existing rows.  
- **AI safety** (unchanged): never pass raw evidence content to `packages/ai`; this story handles bytes at rest and in transit to storage only.

### Git intelligence (recent patterns)

- Recent commits focused on Docker/Prisma CI — when adding `@google-cloud/storage`, **pin versions** consistently with repo (pnpm lockfile); follow existing Dockerfile multi-stage patterns if API image needs GCS libraries.

### Library / version notes

- **@google-cloud/storage**: use current stable compatible with Node 22; prefer **Application Default Credentials** on Cloud Run.  
- **SHA-256**: hex string, lowercase, stored in `content_hash` (64 chars).

### Project context reference

- No `project-context.md` was found in-repo during story creation; primary guardrails are `architecture.md` + this file.

### Completion status

- **review** — Implementation complete; `pnpm test` passes. Run `code-review` workflow next.

### Implementation note (dev-story, 2026-05-05)

- **Verified download** uses full-buffer verification then `reply.send` (appropriate for small text evidence). Reuse `readVerifiedBlobBytes` from `@grc/evidence-ingestion` for future ZIP/report export.
- **Local dev**: empty `GCS_EVIDENCE_BUCKET` / `GCS_BUCKET_NAME` uses a shared in-memory store (not for production). **Production** requires a configured bucket; `POST /v1/my-tasks/.../complete` returns **503** if `NODE_ENV=production` and no bucket is set.
- **Terraform**: WORM retention already defined in [`infra/modules/cloud-storage/main.tf`](../../../infra/modules/cloud-storage/main.tf) — no change required for Task 4.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

### Completion Notes List

- Added `@grc/evidence-ingestion` with `ingestEvidenceBlob`, `submitControlOwnerNoteEvidence`, GCS + in-memory `BlobStoragePort`, and `readVerifiedBlobBytes`.
- Tenant template: append-only grants on `evidence_blobs`; integration test expectations updated for full table list + `evidence_blobs` grants.
- API: `GET /v1/evidence-items/:evidenceItemId/download` with tier + role/access checks; integrity failure → `platform_audit_logs` + `EVIDENCE_INTEGRITY_FAILURE`.
- `pnpm test` and scoped `lint` pass (API has existing `no-console` warning in `server.ts`).

### File List

- `packages/evidence-ingestion/package.json`
- `packages/evidence-ingestion/tsconfig.json`
- `packages/evidence-ingestion/src/index.ts`
- `packages/evidence-ingestion/src/env.ts`
- `packages/evidence-ingestion/src/storage.ts`
- `packages/evidence-ingestion/src/ingest.ts`
- `packages/evidence-ingestion/src/submit-control-owner-note.ts`
- `packages/evidence-ingestion/src/verify.ts`
- `packages/evidence-ingestion/src/ingest.test.ts`
- `packages/db/src/migrations/tenant-template.sql`
- `packages/db/src/tenant-template.test.ts`
- `apps/api/package.json`
- `apps/api/src/server.ts`
- `apps/api/src/routes/v1/my-tasks.ts`
- `apps/api/src/routes/v1/my-tasks.test.ts`
- `apps/api/src/routes/v1/evidence-items.ts`
- `apps/api/src/routes/v1/evidence-items.test.ts`
- `apps/api/src/routes/v1/gaps.ts`
- `apps/api/tests/integration/tenant-isolation.test.ts`
- `.env.example`
- `apps/api/Dockerfile`
- `pnpm-lock.yaml`

## Change Log

- **2026-05-05** — Story 4.1 implemented: evidence ingest package, immutable `evidence_blobs` grants, my-tasks pipeline refactor, verified download route, tests.
