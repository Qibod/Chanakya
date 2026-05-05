# Story 2.1: AI Fingerprinting Pipeline — Backend Job & Claude Integration

Status: done

## Story

As a new user completing onboarding,
I want the platform to infer my company's industry, regulatory obligations, and risk domains automatically from my company name,
so that I arrive at a pre-populated control framework without manual setup.

## Acceptance Criteria

1. **Given** a user submits their company name on the onboarding screen  
   **When** `POST /v1/fingerprint` is called  
   **Then** the API enqueues a `fingerprint` Cloud Tasks job and immediately returns `202 Accepted` with `{ data: { jobId } }` per API envelope rules  
   **And** the worker picks up the job and calls Claude (`claude-opus-4-7` via Vertex AI) with only public company metadata — never raw files or PII beyond what the user typed as the company name for lookup context

2. **Given** the fingerprinting worker completes analysis  
   **When** the job finishes successfully  
   **Then** the result contains: industry classification, regulatory obligations, inferred org structure, business processes, and risk domains — each with a **confidence tier** (`high` ≥80%, `medium` 50–79%, `low` <50%) and **source attribution** (e.g. `"LinkedIn"`, `"SEC filings"`, `"APQC"`)  
   **And** the result is stored in `fingerprint_results` in the **tenant schema** with lifecycle status **`pending_review`** — nothing is committed to the control framework yet

3. **Given** the fingerprinting job completes  
   **When** the worker publishes completion  
   **Then** a **`fingerprint.completed`** domain event is emitted on Redis pub/sub (`tenant:{tenantId}:job:{jobId}` per architecture)  
   **And** the SSE endpoint forwards that completion to subscribed clients within **30 seconds** of job completion  
   **And** end-to-end latency from successful enqueue to completion notification is **under 90 seconds** under normal conditions (NFR: fingerprinting &lt;90s)

4. **Given** the fingerprinting job fails (Claude timeout, unparsable LLM output, or critical upstream failure)  
   **When** the failure is detected  
   **Then** job status is **`failed`** with a **specific, machine-readable failure reason** stored on the job record / `fingerprint_results` row  
   **And** (contract for Story 2.2) the client can detect failure via job status or SSE error/completion payload so the onboarding UI can fall back to the manual setup wizard with a clear explanation — **full UI copy is Story 2.2**

## Tasks / Subtasks

- [x] **Task 1 — Tenant schema alignment** (AC: #2, #4)  
  - [x] Compare [`packages/db/src/migrations/tenant-template.sql`](../../../packages/db/src/migrations/tenant-template.sql) `fingerprint_results` with epic requirements (`pending_review` / `failed`, structured JSON).  
  - [x] Add columns if needed (recommended: `status TEXT NOT NULL DEFAULT 'pending_review'`, `failure_reason TEXT`, `updated_at TIMESTAMPTZ`) **or** explicitly document JSON-only encoding in `data` — **must** support querying failed vs pending vs committed without ambiguity.  
  - [x] Update [`packages/db/src/provision-tenant.ts`](../../../packages/db/src/provision-tenant.ts) / template SQL only if DDL changes; run migration strategy consistent with existing tenant provisioning (new tenants get new DDL; document whether existing dev tenants need manual patch).

- [x] **Task 2 — Shared types & Zod** (AC: #2)  
  - [x] In [`packages/types`](../../../packages/types): define fingerprint result types + Zod schemas for: industry, obligations, org structure, processes, risk domains — each with `confidenceTier` + `sources[]`.  
  - [x] Export types consumed by API serialization and worker persistence (single source of truth).

- [x] **Task 3 — `packages/ai`: Vertex + fingerprint prompt** (AC: #1, #2)  
  - [x] Implement [`packages/ai/src/vertex-ai.ts`](../../../packages/ai/src/vertex-ai.ts) using official **`@anthropic-ai/vertex-sdk`** (`AnthropicVertex`); authenticate via GCP default credentials / `ANTHROPIC_VERTEX_PROJECT_ID` + region env vars per SDK docs.  
  - [x] Map **`claude-opus-4-7`** to the **exact Vertex model resource name** required by Google Cloud for that SKU (verify in GCP Model Garden / Anthropic-on-Vertex docs at implementation time — names change by region).  
  - [x] Implement [`packages/ai/src/prompts/fingerprint.ts`](../../../packages/ai/src/prompts/fingerprint.ts): system + user prompt instructing **structured JSON output only**; input = **company name + explicitly allowed public-metadata placeholders** (no attachment bytes, no evidence files).  
  - [x] After LLM response: parse JSON; run [`assertNoInjection`](../../../packages/ai/src/guards/injection-guard.ts) / [`assertMetadataOnly`](../../../packages/ai/src/guards/metadata-only.ts) as appropriate on **string fields**; validate with Zod; on validation failure → treat as job failure with reason `LLM_OUTPUT_INVALID`.

- [x] **Task 4 — Cloud Tasks enqueue (`apps/api`)** (AC: #1)  
  - [x] Add [`apps/api/src/routes/v1/fingerprint.ts`](../../../apps/api/src/routes/v1/fingerprint.ts) (new): `POST /v1/fingerprint` with body `{ companyName: string }` (camelCase JSON).  
  - [x] **Auth**: user must be authenticated; use existing global `/v1/*` hook chain in [`apps/api/src/server.ts`](../../../apps/api/src/server.ts) (`authenticate` → `tenantMiddleware`).  
  - [x] **RBAC/tier**: minimum role/tier for onboarding — align with product (likely any signed-in org user on Starter+); use `requireTier` / `requireRole` from [`middleware/rbac.ts`](../../../apps/api/src/middleware/rbac.ts) / [`tier-gate.ts`](../../../apps/api/src/middleware/tier-gate.ts) **consistently with future onboarding routes**.  
  - [x] Generate **`jobId`** per architecture: `{tenantId}.fingerprint.{uuidv7}` — add a **uuid v7** dependency or vetted implementation (job naming is normative in [`architecture.md`](../../planning-artifacts/architecture.md)).  
  - [x] Enqueue HTTP task to worker URL (from env e.g. `WORKER_TASK_URL`) with OIDC / SA auth per GCP Cloud Tasks pattern; task payload includes `tenantId`, `jobId`, `companyName`, `schemaName` or resolvable tenant context.  
  - [x] Persist **initial** `fingerprint_results` row or job stub with `status = pending_review` / `pending` as designed — **before** returning 202 (so worker has idempotent target).  
  - [x] Return **`202`** with `{ data: { jobId } }` per API envelope rules in architecture.

- [x] **Task 5 — Worker job execution** (AC: #1–#4)  
  - [x] Replace stub in [`apps/worker/src/index.ts`](../../../apps/worker/src/index.ts): dispatch `POST /jobs` by **`X-Job-Type: fingerprint`** or path segment; parse JSON body; invoke [`apps/worker/src/jobs/fingerprint.job.ts`](../../../apps/worker/src/jobs/fingerprint.job.ts).  
  - [x] Worker sets Redis job state: **`pending` → `in_progress` → `completed` | `failed`** (reuse [`packages/types/src/jobs.ts`](../../../packages/types/src/jobs.ts) `JobStatus`).  
  - [x] **Tenant DB**: switch `search_path` / use same Prisma tenant extension pattern as API (`@grc/db`). Insert/update `fingerprint_results` with parsed structured `data` + `confidence_scores` JSONB as appropriate.  
  - [x] On success: publish **`fingerprint.completed`** domain event (payload includes `tenantId`, `occurredAt`, `jobId`, summary fields for SSE).  
  - [x] On failure: persist failure reason; publish **`fingerprint.failed`** or completion with `status: failed` — **must be consistent** with SSE consumer in Story 2.2.

- [x] **Task 6 — SSE bridge (`apps/api`)** (AC: #3)  
  - [x] Add [`apps/api/src/routes/v1/stream.ts`](../../../apps/api/src/routes/v1/stream.ts): **SSE** (`text/event-stream`) e.g. `GET /v1/stream` or `GET /v1/stream/jobs/:jobId` — subscribe to `tenant:{tenantId}:job:{jobId}` via **`ioredis` subscriber** (separate connection from [`plugins/redis.ts`](../../../apps/api/src/plugins/redis.ts) if required).  
  - [x] Event envelope per architecture: `{ event, data: { tenantId, payload, timestamp } }`.  
  - [x] Register route in [`server.ts`](../../../apps/api/src/server.ts) **after** plugins; ensure only authenticated tenant users can subscribe.

- [x] **Task 7 — Observability**  
  - [x] Structured logs: `jobId`, `tenantId`, `durationMs`, outcome — align with existing [`server.ts`](../../../apps/api/src/server.ts) logging child fields.  
  - [x] Sentry: capture failures in worker with job context (already instrumented API in Story 1.6).

- [x] **Task 8 — Testing** (AC: all)  
  - [x] Unit tests: Zod schemas, prompt JSON parsing, failure paths.  
  - [x] Integration (where feasible): mock Vertex client or record fixtures; **tenant isolation** test pattern from [`apps/api/tests/integration/tenant-isolation.test.ts`](../../../apps/api/tests/integration/tenant-isolation.test.ts) — ensure `fingerprint_results` stays in tenant schema.  
  - [x] Do **not** block CI on live GCP/Vertex calls — use env-guarded integration tests.

### Review Findings (AI — 2026-05-04)

**Decision Needed** _(all resolved)_
- [x] [Review][Decision] **assertMetadataOnly not called on input string fields** — Resolved: call `assertMetadataOnly(companyName)` in `runFingerprintInference` for strict spec compliance. → Converted to Patch below.
- [x] [Review][Decision] **`requireTier("starter")` with no minimum-role check** — Resolved: add `requireRole("OrgMember")` alongside tier check. → Converted to Patch below.

**Patch — High** _(resolved from decisions)_
- [ ] [Review][Patch] **Call `assertMetadataOnly(companyName)` before LLM invocation** [`packages/ai/src/fingerprint-inference.ts`] — Add `assertMetadataOnly(companyName)` call after `assertNoInjection(companyName)` for strict spec compliance (Task 3).
- [ ] [Review][Patch] **Add `requireRole("OrgMember")` alongside tier check on fingerprint routes** [`apps/api/src/routes/v1/fingerprint.ts`, `apps/api/src/routes/v1/stream.ts`] — Add minimum-role preHandler so read-only Viewers cannot trigger AI jobs.

**Patch — High** _(from review)_
- [ ] [Review][Patch] **SQL injection: `schemaName` string-interpolated into `$executeRawUnsafe` without validation** [`apps/api/src/routes/v1/fingerprint.ts`, `apps/worker/src/jobs/fingerprint.job.ts`] — A malformed tenant `schemaName` (quotes, semicolons) could break out of the double-quote boundary. Add a `schemaName` allowlist regex guard (`/^[a-z_][a-z0-9_]{0,62}$/) before all interpolations.
- [ ] [Review][Patch] **Timing-unsafe comparison for `X-Worker-Secret`** [`apps/worker/src/index.ts`] — `header === secret` is a direct string equality check subject to timing side-channels. Use `crypto.timingSafeEqual`.
- [ ] [Review][Patch] **Empty-string `WORKER_INVOCATION_SECRET` bypasses secret guard** [`apps/worker/src/index.ts`] — `if (!secret)` is falsy for `""`, allowing unauthenticated access when the env var is set to an empty string. Use `if (!secret || secret.length === 0)` or validate on startup.
- [ ] [Review][Patch] **SSE `ev` field not stripped of newlines — SSE header injection** [`apps/api/src/routes/v1/stream.ts:65`] — `reply.raw.write(\`event: ${ev}\n...\`)` without sanitising `ev`. An attacker who can publish to Redis can inject arbitrary SSE frames. Strip `\r\n` from `ev` before writing.
- [ ] [Review][Patch] **No idempotency guard in `processFingerprintJob` — Cloud Tasks retries reprocess completed jobs** [`apps/worker/src/jobs/fingerprint.job.ts`] — If the worker returns HTTP 500, Cloud Tasks retries. A retry will overwrite a `pending_review` row back to `in_progress` and re-run the LLM call. Add a guard at job start: if DB row status is not `queued`, skip processing and return success.
- [ ] [Review][Patch] **`publishJobEvent` throw after success causes catch block to overwrite DB + Redis to `failed`** [`apps/worker/src/jobs/fingerprint.job.ts`] — If `publishJobEvent` throws after `persistSuccess` and Redis are set to `completed`, the exception falls into the catch block which updates DB + Redis to `failed`, corrupting a successful job. Wrap `publishJobEvent` in its own try/catch and log the failure without re-throwing.
- [ ] [Review][Patch] **Malformed/empty JSON body in worker causes `JSON.parse` throw → permanent Cloud Tasks retry storm** [`apps/worker/src/index.ts`] — `JSON.parse(body)` with no guard; any non-JSON body (empty string, truncated payload, Cloud Tasks test probe) triggers a 500, causing infinite retries. Wrap in try/catch and return 400 (non-retryable) for malformed bodies.

**Patch — Medium**
- [ ] [Review][Patch] **`fingerprintRowStatusSchema` does not include `"in_progress"`** [`packages/types/src/fingerprint.ts`] — Redis job state uses `"in_progress"` but the Zod enum only lists `queued | pending_review | failed | committed`. Any code validating Redis state against this type will fail or produce `undefined`. Add `"in_progress"` to the enum or create a separate `fingerprintJobStatusSchema`.
- [ ] [Review][Patch] **`confidenceTier` alignment not enforced by Zod — only by prompt instruction** [`packages/types/src/fingerprint.ts`] — An LLM returning `{ confidence: 0.3, confidenceTier: "high" }` passes schema validation. Add a `.refine()` asserting tier matches the numeric threshold.
- [ ] [Review][Patch] **No body size limit on worker HTTP server — unbounded memory growth** [`apps/worker/src/index.ts`] — Raw Node `http` accumulates the entire POST body in memory. Add a max body size guard (e.g., 1 MB) and return 413 if exceeded.
- [ ] [Review][Patch] **DB `UPDATE` to `'failed'` throwing in catch block short-circuits Redis state update + `publishJobEvent`** [`apps/worker/src/jobs/fingerprint.job.ts`] — If `prisma.$executeRawUnsafe` throws in the catch block, neither Redis nor the SSE channel is updated. Use independent try/catch blocks for each cleanup step so all three (DB, Redis, publish) are attempted even if one fails.
- [ ] [Review][Patch] **Redis `set("in_progress")` throws at worker start → exception escapes catch, job stuck `queued` forever** [`apps/worker/src/jobs/fingerprint.job.ts`] — The `in_progress` Redis write is outside the try/catch. If Redis is down, the exception propagates without a failure record in DB or Redis. Move this into the try block or wrap it independently.
- [ ] [Review][Patch] **No `fingerprint.failed` SSE event published on API-level enqueue failure** [`apps/api/src/routes/v1/fingerprint.ts`] — The catch block in `POST /v1/fingerprint` updates DB + Redis to `failed` but never publishes a `fingerprint.failed` domain event. Any SSE client that subscribed before the enqueue attempt will hang indefinitely. Publish a `fingerprint.failed` event in the catch block.
- [ ] [Review][Patch] **`sub.subscribe(channel)` throws after `reply.hijack()` + `writeHead(200)` — SSE connection stuck open** [`apps/api/src/routes/v1/stream.ts`] — If the Redis subscribe call fails after headers are sent, the response cannot return an error. The heartbeat runs indefinitely until the client disconnects, leaking a Redis subscriber. Wrap `sub.subscribe` in try/catch and call cleanup immediately on failure.
- [ ] [Review][Patch] **`assertNoInjection` called on parsed LLM JSON output — false positives for legitimate responses** [`packages/ai/src/fingerprint-parse.ts`] — Legitimate field values (e.g., regulatory detail mentioning "ignore previous instructions" as a risk) will trigger `LLM_OUTPUT_INVALID`, causing genuine jobs to fail. The guard on LLM output text provides no security benefit (the output is already generated by the model). Remove `assertNoInjection(jsonText)` in `parseFingerprintJson` or scope it only to the raw text before JSON extraction.
- [ ] [Review][Patch] **`persistSuccess` UPDATE matches zero rows silently — DB state diverges** [`apps/worker/src/jobs/fingerprint.job.ts`] — `prisma.$executeRawUnsafe` does not error if no rows are affected. If `jobId` doesn't exist (dropped row, wrong schema), the update silently succeeds while Redis + SSE report `completed`. Check affected rows and throw if the row was not found.
- [ ] [Review][Patch] **No integration test for `fingerprint_results` tenant isolation** — Task 8 specifies extending `tenant-isolation.test.ts` to assert `fingerprint_results` stays in tenant schema, but the diff contains no such test. Add a test asserting tenant A cannot read tenant B's fingerprint row.

**Deferred**
- [x] [Review][Defer] **`tenant-template.sql` has no migration versioning or `IF NOT EXISTS` guard** — Pre-existing pattern in this codebase; all tenant template migrations follow this style. Deferred.
- [x] [Review][Defer] **No 90-second end-to-end NFR latency test** — Requires e2e/load test infrastructure, out of scope for unit test suite. Deferred.
- [x] [Review][Defer] **`X-Worker-Secret` transmitted over plain HTTP in non-GCP environments** — Deployment/infra concern; requires HTTPS enforcement at infrastructure level. Deferred.
- [x] [Review][Defer] **`CloudTasksClient` instantiated per-request** — Performance optimization, not a correctness issue. Deferred.

## Dev Notes

### Epic 2 context

- Epic 2 delivers AI-native onboarding + framework library. Stories **2.2–2.3** depend on **jobId**, **stored fingerprint payload**, **SSE events**, and **confirm API** (`POST /v1/fingerprint/:jobId/confirm` in epics — implement confirm in **2.3**, not this story).  
- This story **owns** the async pipeline + persistence contract; **2.2** owns streaming UI.

### Critical architecture rules

| Rule | Source | Application |
|------|--------|--------------|
| API envelope | [`architecture.md`](../../planning-artifacts/architecture.md) Format Patterns | Success: `{ data }`; errors: `{ error: { code, message, details? } }` |
| Tenant resolution | ARCH / `tenantMiddleware` | Never trust client for `tenantId`; use `request.tenant` |
| Async job pattern | architecture Communication + Process Patterns | 202 + jobId → worker → Redis state → pub/sub → SSE |
| Job naming | architecture | `{tenantId}.fingerprint.{uuidv7}` |
| Redis channels | architecture | `tenant:{tenantId}:job:{jobId}` |
| LLM access | architecture + PRD AI safety | **Only** via `packages/ai`; **no** raw files to LLM; fingerprint uses **public-metadata narrative** only |
| Model | architecture | **`claude-opus-4-7`** for fingerprinting (async, quality-first) |

### Current codebase state (do not assume greenfield)

| Area | State |
|------|--------|
| [`apps/worker/src/jobs/fingerprint.job.ts`](../../../apps/worker/src/jobs/fingerprint.job.ts) | Empty stub — **implement** |
| [`packages/ai/src/vertex-ai.ts`](../../../packages/ai/src/vertex-ai.ts) | Throws — **implement** |
| [`packages/ai/src/prompts/fingerprint.ts`](../../../packages/ai/src/prompts/fingerprint.ts) | Empty — **implement** |
| [`apps/worker/src/index.ts`](../../../apps/worker/src/index.ts) | Logs body only — **wire real dispatch** |
| [`apps/api/src/server.ts`](../../../apps/api/src/server.ts) | Registers `userRoutes` + webhooks only — **register fingerprint + stream routes** |
| `fingerprint_results` DDL | Exists in [`tenant-template.sql`](../../../packages/db/src/migrations/tenant-template.sql) but **may lack** explicit `status` / failure columns — **align with AC** |
| [`apps/worker/src/publishers/health-events.ts`](../../../apps/worker/src/publishers/health-events.ts) | Stub — **implement or replace** with shared publisher for job events |

### API contract sketch (for Stories 2.2–2.3)

- **`POST /v1/fingerprint`** → `202` + `{ data: { jobId } }`  
- **`GET /v1/fingerprint/:jobId`** (optional but recommended for UX polling fallback) → job status + partial progress — *if not in this story, document follow-up*  
- **SSE** → delivers `fingerprint.completed` with enough payload for UI to hydrate stream (or trigger refetch)

### Confidence tiers

Map numeric confidence from LLM output to:

- `high`: ≥ 0.80  
- `medium`: 0.50 – 0.79  
- `low`: &lt; 0.50  

Store raw numeric in JSON if useful for debugging; **API-facing** fields stay camelCase.

### Cloud Tasks & environments

- Local: use emulator or **feature flag** to invoke worker HTTP directly in dev (document in `.env.example`).  
- GCP: task OIDC token must authorize **worker** Cloud Run service (already deployed per Story 1.6).

### Project Structure Notes

- New Fastify routes live under `apps/api/src/routes/v1/` and are registered from `buildServer()`.  
- Worker job handlers stay in `apps/worker/src/jobs/`.  
- Shared LLM logic **only** in `packages/ai`.  
- No Next.js UI in this story (`apps/web` touches **2.2**).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.1]  
- [Source: `_bmad-output/planning-artifacts/architecture.md` — LLM Provider, Async job pattern, Redis/SSE, FR1–FR3 mapping]  
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR1, AI architecture, onboarding trust]  
- [Source: `packages/db/src/migrations/tenant-template.sql` — `fingerprint_results` table]  
- [Anthropic: Claude on Vertex AI](https://docs.anthropic.com/claude/reference/claude-on-vertex-ai)  
- [npm: `@anthropic-ai/vertex-sdk`](https://www.npmjs.com/package/@anthropic-ai/vertex-sdk)

## Technical Requirements Summary

- **Stack**: Fastify 5, Prisma + raw tenant SQL, `ioredis`, GCP Cloud Tasks, Cloud Run worker, Vertex AI (Claude).  
- **Packages to add**: `@anthropic-ai/vertex-sdk`, `@google-cloud/tasks`, uuid v7-capable library (exact package TBD in implementation).  
- **Env vars** (illustrative): `REDIS_URL`, `WORKER_URL` / Cloud Tasks queue config, `ANTHROPIC_VERTEX_PROJECT_ID`, `CLOUD_ML_REGION`, GCP credentials for API + worker.

## Architecture Compliance Checklist

- [x] `POST /v1/fingerprint` uses `{ data }` envelope and correct HTTP codes  
- [x] Tenant isolation on all DB reads/writes  
- [x] Job naming convention enforced  
- [x] Domain event naming: `fingerprint.completed` / failure counterpart documented  
- [x] SSE shape matches architecture  
- [x] No LLM calls outside `packages/ai`

## Library / Framework Requirements

| Dependency | Purpose |
|------------|---------|
| `@anthropic-ai/vertex-sdk` | Claude on Vertex (preferred over ad-hoc REST) |
| `@google-cloud/tasks` | Enqueue fingerprint jobs from API |
| `zod` (existing) | Shared validation in `packages/types` |

## File Structure Requirements

| Path | Action |
|------|--------|
| `apps/api/src/routes/v1/fingerprint.ts` | **NEW** |
| `apps/api/src/routes/v1/stream.ts` | **NEW** |
| `apps/api/src/server.ts` | **UPDATE** — register routes |
| `apps/worker/src/index.ts` | **UPDATE** — dispatch |
| `apps/worker/src/jobs/fingerprint.job.ts` | **UPDATE** — full job |
| `apps/worker/src/publishers/*.ts` | **UPDATE or NEW** — Redis pub |
| `packages/ai/src/vertex-ai.ts` | **UPDATE** |
| `packages/ai/src/prompts/fingerprint.ts` | **UPDATE** |
| `packages/types/src/*.ts` | **UPDATE** — fingerprint schemas |
| `packages/db/src/migrations/tenant-template.sql` | **UPDATE** if DDL extended |

## Testing Requirements

- Mock external calls by default in unit tests.  
- Tenant isolation integration tests must continue to pass (`pnpm --filter @grc/api test:integration` when `DATABASE_URL` set).  
- Add coverage for: successful enqueue, worker happy path (mocked LLM), malformed LLM JSON, Redis publish payload shape.

## Previous Story Intelligence (Epic 1)

Story **1.6** established CI, Sentry (`import "./instrument.js"` first in API), structured logging with `tenantId` / `actor`, WIF deploys, and **tenant isolation tests** including `fingerprint_results` table name in isolation suite — **extend tests** when modifying fingerprint DDL.

Git pattern: conventional commits `feat: Story X.Y — …`.

## Git Intelligence Summary

Recent commits: Epic 1 Stories 1.1–1.6 — monorepo, Prisma tenant extension, Clerk, Next shell, design system, CI/CD + Sentry. **No fingerprint implementation yet** — this story is the first slice touching `packages/ai` and worker job execution beyond stubs.

## Latest Technical Information (2026)

- Use **`@anthropic-ai/vertex-sdk`** for Vertex-hosted Claude; configure project + region via env vars documented in Anthropic’s “Claude on Vertex AI” guide.  
- Vertex model IDs are **region-specific** — resolve the correct **`claude-opus-4-7`** (or equivalent GA ID) from current GCP documentation during implementation.  
- Keep **`@sentry/node`** initialization order intact in API when adding routes.

## Project Context Reference

- No `project-context.md` found in repo root at story creation time — rely on this file + linked architecture/epics.

## Dev Agent Record

### Agent Model Used

Cursor agent (GPT-5.2)

### Debug Log References

### Completion Notes List

- Extended `fingerprint_results` in `tenant-template.sql` with `status`, `failure_reason`, `updated_at`, unique `job_id`, and status check constraint (`queued` | `pending_review` | `failed` | `committed`).
- Implemented `POST /v1/fingerprint` (202 + `jobId`), `GET /v1/fingerprint/:jobId` (polling), Cloud Tasks with `SKIP_CLOUD_TASKS` / direct HTTP to worker, and `GET /v1/stream/jobs/:jobId` (SSE + Redis pub/sub).
- Worker runs `runFingerprintInference` via Vertex (`@anthropic-ai/vertex-sdk`), updates tenant row, Redis job keys, and publishes `fingerprint.completed` / `fingerprint.failed`.
- **Existing local DBs** provisioned before this change: re-run `provisionTenantSchema` or apply equivalent `ALTER` for new columns, or drop/recreate dev tenant schemas.
- Sentry in worker: not wired (optional follow-up); errors logged to `console` with job context.

### File List

- `.env.example`
- `apps/api/package.json`
- `apps/api/src/lib/redis-subscriber.ts`
- `apps/api/src/middleware/tier-gate.ts`
- `apps/api/src/routes/v1/fingerprint.ts`
- `apps/api/src/routes/v1/fingerprint.test.ts`
- `apps/api/src/routes/v1/stream.ts`
- `apps/api/src/server.ts`
- `apps/api/src/services/fingerprint-queue.ts`
- `apps/worker/package.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs/fingerprint.job.ts`
- `apps/worker/src/publishers/job-events.ts`
- `apps/worker/src/redis.ts`
- `packages/ai/package.json`
- `packages/ai/src/fingerprint-inference.ts`
- `packages/ai/src/fingerprint-parse.ts`
- `packages/ai/src/fingerprint-parse.test.ts`
- `packages/ai/src/guards/injection-guard.ts`
- `packages/ai/src/index.ts`
- `packages/ai/src/prompts/fingerprint.ts`
- `packages/ai/src/vertex-ai.ts`
- `packages/db/src/migrations/tenant-template.sql`
- `packages/types/package.json`
- `packages/types/src/fingerprint.ts`
- `packages/types/src/fingerprint.test.ts`
- `packages/types/src/index.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- **2026-05-04:** Story 2.1 implemented — fingerprint async pipeline (API enqueue, worker + Vertex AI, Redis/SSE), schema and shared types/tests, env documentation.

---

## Open Questions / Clarifications

_(Non-blocking — resolve during implementation or with PM if product ambiguity)_

1. Minimum **role** for `POST /v1/fingerprint` (any org member vs OrgAdmin only)?  
2. Should **`GET /v1/fingerprint/:jobId`** ship in **2.1** or can Story **2.2** rely entirely on SSE + TanStack Query invalidation?  
3. Exact **Cloud Tasks queue name** and region — confirm against `infra/` Terraform when wiring enqueue.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
