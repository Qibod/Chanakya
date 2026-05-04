---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
lastStep: 8
status: 'complete'
completedAt: '2026-05-03'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/research/domain-grc-platform-smb-midmarket-audit-risk-research-2026-05-03.md'
  - '_bmad-output/planning-artifacts/research/market-grc-platform-buyers-pricing-gtm-smb-midmarket-research-2026-05-03.md'
workflowType: 'architecture'
project_name: 'GRC'
user_name: 'Vijay'
date: '2026-05-03'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

53 FRs across 7 capability domains — 36 MVP / 16 Growth / 1 Vision.

| Domain | FR Count | Architectural Weight |
|---|---|---|
| Onboarding & Company Intelligence | 5 | High — async AI pipeline, confidence scoring data model, public-source ingestion |
| Compliance & Control Management | 7 | High — unified control library schema, cross-framework mapping engine, real-time state machine |
| Evidence Management | 7 | Critical — immutable write-once pipeline, SHA-256 integrity chain, version model, conversation threading |
| Integration & Connectivity | 6 | High — event-driven connector framework, webhook receiver, polling scheduler, health state machine |
| Audit Management & Reporting | 9 | High — async report generation pipeline, scoped external access model, LLM co-pilot with injection guards |
| Risk & Regulatory Intelligence | 6 | Medium (MVP) / High (Growth) — rolling score computation, external signal ingestion (Growth) |
| User & Access Management | 6 | High — RBAC with 8 roles, SCIM 2.0, group-to-role mapping, immediate session invalidation |
| Platform Admin & Developer Tools | 7 | Medium — subscription enforcement, full data export, tamper-evident audit log |

**Non-Functional Requirements (Architectural Drivers):**

| NFR Category | Key Drivers | Architectural Impact |
|---|---|---|
| Performance | Dashboard <2s; evidence sync <5min (webhook); report <60s; API <500ms p95; fingerprinting <90s; AI co-pilot <5s | Read-optimised query layer; async job queue required; separate LLM path from synchronous API |
| Security | AES-256 at rest; TLS 1.3; BYOK (Scale); SHA-256 evidence hashing; pre-GA pen test; automated cross-tenant regression; SOC 2 Type II | Evidence pipeline is write-once at storage layer; secrets manager per-tenant key hierarchy; all permission checks server-side only |
| Scalability | 1,000 → 10,000 tenants; 500 concurrent users/tenant; 10TB/tenant; 100k evidence events/hour | Schema-per-tenant multi-tenancy; horizontally scalable AI inference; object storage with per-tenant prefixes; separate polling scheduler service |
| Reliability | 99.9% SLA (Growth/Scale); RTO 1h; RPO 1h; 99.9% evidence delivery; zero-downtime deploys | Dead-letter queue for failed evidence events; blue-green or rolling deployment strategy; automated backups every 6h |
| Accessibility | WCAG 2.1 Level AA; colour not sole status indicator; accessible 2D fallback for canvas/3D | Canvas and 3D modules must be isolated with runtime fallback — cannot be core render path |
| Data & Compliance | SOX retention 7 years; GDPR erasure conflict surfacing; EU data residency; data minimisation on AI inputs | Evidence metadata separate from evidence blobs; erasure conflict detection service; regional deployment topology for EU tenants |

**Scale & Complexity:**

- **Complexity level:** Enterprise
- **Primary technical domain:** Full-stack SaaS — multi-tenant backend, event-driven data pipeline, AI/LLM integration, real-time frontend
- **Estimated architectural components:** 12–15 distinct services/layers

### Technical Constraints & Dependencies

| Constraint | Source | Impact |
|---|---|---|
| Schema-per-tenant multi-tenancy | PRD — Tenant Model, SOC 2 isolation requirement | Database design, ORM configuration, query layer must enforce tenant ID on every query |
| Write-once evidence storage (SHA-256) | PRD — Evidence Architecture | Object storage must support object lock; hashing pipeline on ingest path |
| Async AI jobs (fingerprinting, report gen) | PRD — AI Architecture | Job queue required; progress state + completion notification pattern |
| Synchronous LLM for co-pilot (<5s p95) | PRD — AI Architecture + NFR Performance | Separate synchronous LLM path; streaming response to client |
| Webhooks-first with polling fallback | PRD — Integration Catalog | Event-driven integration layer + scheduled polling scheduler as separate concerns |
| EU data residency | PRD — Domain Requirements (GDPR) | Multi-region deployment; tenant region locked at provisioning |
| SOC 2 Type II from day one | PRD — Implementation Considerations | Audit logging, access controls, encryption are non-negotiable from initial build |
| Zero-downtime deployments | PRD — Reliability NFR | Blue-green or rolling deployment strategy required |
| Canvas features require 2D fallback | PRD — Accessibility NFR | Canvas is isolated module, not core render path |

### Cross-Cutting Concerns Identified

1. **Multi-tenant isolation** — Tenant ID enforcement on every database query, cache key, storage prefix, and API response. Automated regression tests block deployment on any violation.
2. **Evidence integrity chain** — SHA-256 hash on ingest, stored with immutable blob, verified on every export. Mutable metadata lives in a separate record. Touches ingestion pipeline, storage layer, API export, and report generation.
3. **RBAC enforcement** — 8 roles, server-side on every request. Client-side UI is decorative only. Tier-gate checks also server-side.
4. **Async job pattern** — Fingerprinting, report generation, and batch AI processing share a common async job queue → worker → progress notification → completion pattern. Must be consistent across all consumers.
5. **Real-time state propagation** — Control health changes triggered by integration events must propagate to the compliance dashboard in near-real-time. Requires WebSocket/SSE push or aggressive polling.
6. **Observability & audit logging** — Every platform action written to tamper-evident append-only log. Both a compliance requirement (SOC 2) and a product feature (FR51). Touches every service.
7. **AI data safety** — Evidence files never passed as raw text to LLM. Only structured metadata used. Injection guard on co-pilot. AI-generated content flagged for human review.
8. **Subscription tier enforcement** — Usage limits enforced server-side on every relevant API call. Metering data must be accurate and low-latency.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack SaaS — Next.js frontend on Vercel, Node.js API + async workers on GCP Cloud Run, PostgreSQL on Cloud SQL, event-driven background job processing via Cloud Tasks.

### Technology Choices

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript throughout | Type safety critical for multi-tenant schema, RBAC enforcement, evidence data model |
| Package manager | pnpm | Required by Turborepo; workspace hoisting, speed |
| Frontend | Next.js 16 (App Router, Turbopack) | PRD-specified; hybrid SSR + SPA shell; Turbopack stable |
| API server | Fastify (Node.js) | 2× faster than Express; TypeScript-native; JSON Schema validation built-in; essential for 500ms p95 API target |
| ORM | Prisma v7 | Type-safe queries; strong migration tooling; Client Extensions for schema-per-tenant switching |
| Styling | Tailwind CSS v4 | Utility-first; consistent design system; co-located with components |
| Database | Cloud SQL for PostgreSQL (MVP) | Simpler ops at MVP scale; clear upgrade path to AlloyDB at Growth |
| Object storage | GCP Cloud Storage + Object Retention Lock | WORM-capable; SHA-256 verified; object-level retention policies meet SOX/GDPR requirements |
| Job queue | GCP Cloud Tasks | Delivery guarantees; rate limiting; dead-letter queues; HTTP-invoked workers — matches async AI job pattern |
| Workers | GCP Cloud Run Jobs | Containerised; triggered by Cloud Tasks; scales to zero; isolated per-job execution for AI pipeline |
| API hosting | GCP Cloud Run (service) | Always-on HTTP; auto-scaling; same container runtime as workers |
| Secrets | GCP Secret Manager | Per-tenant key hierarchy; integration credential encryption |
| Frontend hosting | Vercel | Best-in-class Next.js deployment; Edge Network for marketing/login pages |

### Monorepo Structure

**Initialization Command:**

```bash
npx create-turbo@latest grc --package-manager pnpm
```

**Repository Structure:**

```
grc/                           # Turborepo root
├── apps/
│   ├── web/                   # Next.js 16 → Vercel (frontend + BFF API routes)
│   ├── api/                   # Fastify REST API → Cloud Run service
│   └── worker/                # Async job processor → Cloud Run Jobs
├── packages/
│   ├── db/                    # Prisma schema, migrations, generated client
│   ├── ui/                    # Shared React component library (design system)
│   ├── types/                 # Shared TypeScript interfaces (evidence, controls, tenants, RBAC)
│   ├── ai/                    # Shared LLM utilities, prompt templates, injection guards
│   └── config/                # Shared ESLint, TypeScript, Tailwind configs
└── infra/                     # GCP infrastructure (Terraform)
    ├── cloud-sql/
    ├── cloud-run/
    ├── cloud-tasks/
    └── cloud-storage/
```

**Architectural Decisions Provided by Starter:**

- `apps/api` (Fastify) is separate from `apps/web` Next.js API routes — public REST API (FR23) needs a clean versioned surface independent of Next.js
- Workers share `apps/api` codebase without bundling Next.js; independently scalable on Cloud Run
- `packages/ai` is a shared package — all LLM consumers (co-pilot, report gen, fingerprinting, regulatory agent, inline AI) share injection guards, metadata-only evidence handling, and human-review flagging
- `packages/db` is the single source of truth for schema and migrations; consumed by both `apps/api` and `apps/worker`

**Note:** Project initialization using the above command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Schema-per-tenant implementation via Prisma Client Extensions
- Authentication provider: Clerk (handles SAML, OIDC, SCIM)
- External auditor token model (custom, not Clerk)
- LLM provider: Anthropic Claude via GCP Vertex AI
- Real-time update mechanism: SSE

**Important Decisions (Shape Architecture):**
- Caching: Cloud Memorystore (Redis)
- RBAC: custom Fastify middleware with TypeScript policy constants
- State management: TanStack Query + Zustand
- Component library: shadcn/ui on Radix UI
- Canvas library: React Flow v12
- Form handling: React Hook Form + Zod
- CI/CD: GitHub Actions + Vercel auto-deploy
- Observability: Sentry + GCP Cloud Logging + Cloud Monitoring

**Deferred Decisions (Post-MVP):**
- AlloyDB upgrade from Cloud SQL (Growth/Scale trigger: >500 concurrent tenants or query latency SLA breach)
- WebSocket upgrade from SSE (trigger: Growth canvas collaboration requires two-way real-time)
- Datadog log aggregation (trigger: Cloud Logging query UX becomes a bottleneck)
- tldraw evaluation for Vision-phase whiteboard features

---

### Data Architecture

**Schema-per-tenant (Prisma Client Extensions):**
- Single Prisma client instance; Client Extension intercepts every query and executes `SET search_path = tenant_{id}, public` before the query runs
- Tenant ID injected from request context (Fastify request decorator); never from client-supplied headers
- Schema provisioning on tenant creation: Prisma Migrate run against the new schema; template schema cloned
- Decision: Prisma Client Extensions with dynamic `search_path` injection per request
- Affects: `packages/db`, `apps/api` request lifecycle, all DB queries

**Caching — GCP Cloud Memorystore (Redis):**
- Session token cache (Clerk session validation results, short TTL)
- Compliance dashboard control health (per-tenant, 30s TTL, invalidated on evidence event)
- API rate limiting counters (per-tenant, per-tier, sliding window)
- Async job progress state (job ID → status → progress percentage)
- Decision: Cloud Memorystore Redis; accessed from `apps/api` and `apps/worker` via `ioredis`
- Affects: all API routes, worker job state, dashboard SSE feed

**Evidence Deduplication:**
- SHA-256 computed on file content before write
- `SELECT 1 FROM evidence_blobs WHERE content_hash = $hash` before Cloud Storage write
- On match: create new `evidence_items` metadata record pointing to existing blob; skip upload
- On miss: upload blob to Cloud Storage with Object Retention Lock, then insert `evidence_blobs` + `evidence_items`
- Decision: Hash-before-write deduplication in `apps/worker` ingestion pipeline
- Affects: `apps/worker` evidence ingestion, `packages/db` evidence schema

---

### Authentication & Security

**Primary Auth — Clerk:**
- Handles: user sign-up/in, session management, magic links (FR45 board portal), SAML 2.0 + OIDC SSO (FR42), SCIM 2.0 provisioning/deprovisioning (FR43), group-to-role sync webhooks (FR44)
- Clerk webhook → Fastify API endpoint → update local `users` + `role_assignments` tables on every Clerk event
- SCIM deprovisioning event → immediate session invalidation via Clerk API + Redis session cache flush
- Decision: Clerk as primary auth provider from MVP; Growth SSO/SCIM features use Clerk enterprise plan
- Affects: `apps/web` auth routes, `apps/api` session middleware, `packages/db` user schema

**External Auditor Token Model:**
- UUID v7 tokens stored in `audit_access_tokens` table: `(id, audit_id, scoped_control_ids[], created_by, expires_at, revoked_at, last_used_at)`
- Token validated at Fastify API middleware on every auditor request — not a Clerk session
- Non-enumerable: UUID v7 is time-ordered but not guessable; no sequential ID in URL
- Revocation: set `revoked_at`; Redis cache entry (token → valid/revoked) with 60s TTL for performance
- Decision: Custom token model in `apps/api` + `packages/db`; independent of Clerk
- Affects: FR30–FR32, `apps/api` auditor routes, `packages/db`

**RBAC Implementation:**
- 8 roles defined as TypeScript `enum` in `packages/types`: `OrgAdmin | AuditDirector | ControlOwner | ReadOnly | BoardExecutive | ExternalAuditor | Developer | PlatformSuperAdmin`
- Permission matrix as `const` object in `packages/types`: `PERMISSIONS[role][action]` → `boolean`
- Fastify `preHandler` hook: extract role from Clerk session → check `PERMISSIONS[role][routeAction]`; return 403 if false
- Tier gate: separate `preHandler` for tier checks — `TIER_GATES[feature][tier]` → `boolean`; return 402 if insufficient tier
- All checks server-side; client receives 403/402 only — no role data in API responses
- Decision: Custom Fastify middleware; policy constants in `packages/types`
- Affects: every `apps/api` route, `packages/types`

---

### API & Communication Patterns

**BFF Communication (Next.js → Fastify):**
- Next.js server components and server actions call Fastify Cloud Run service over HTTPS
- Authenticated with GCP Service Account key stored in Vercel environment variable; `Authorization: Bearer {sa_token}` on every server-side call
- Client-side API calls go to Next.js API routes (BFF layer) which proxy to Fastify; never direct from browser to Cloud Run
- Decision: HTTPS proxy pattern; browser → Next.js BFF → Fastify API → DB
- Affects: `apps/web` API routes, `apps/api` service auth middleware

**Real-time Updates — SSE:**
- Fastify `/v1/tenants/:tenantId/stream` endpoint: per-tenant SSE stream
- Control health events published to Redis pub/sub channel; Fastify SSE handler subscribes and forwards to connected clients
- Client reconnects automatically on disconnect (EventSource API handles this natively)
- Upgrade path: replace SSE with WebSocket if Growth canvas collaboration requires bidirectional real-time
- Decision: SSE via Redis pub/sub for MVP dashboard; WebSocket upgrade deferred
- Affects: `apps/api` stream routes, `apps/web` dashboard components, Redis

**API Versioning:** URL prefix `/v1/` on all Fastify routes. New breaking changes increment to `/v2/` with deprecation notice in response headers.

**Rate Limiting:** `@fastify/rate-limit` plugin; per-tenant sliding window; limits sourced from tier config in `packages/types`; rate limit headers returned on every response; 429 on breach.

---

### Frontend Architecture

**State Management:**
- **TanStack Query v5** for all server state: controls, evidence, audit data, integration health, dashboard metrics. Query keys namespaced by tenant: `['tenant', tenantId, 'controls', ...]`
- **Zustand** for UI-local state: modal open/close, canvas viewport, sidebar collapsed state, notification queue
- No Redux; no Context API for shared data (TanStack Query is the cache)
- Decision: TanStack Query v5 + Zustand; pattern enforced across all `apps/web` features

**Component Library — shadcn/ui:**
- shadcn/ui components copied into `packages/ui` — owned, not a dependency
- Radix UI primitives as the accessibility foundation
- Tailwind v4 for all styling; no inline styles; no CSS modules
- Design tokens defined in `packages/ui/tokens` (colours, spacing, typography) — single source for Apple-grade consistency
- Decision: shadcn/ui in `packages/ui`; consumed by `apps/web`

**Canvas — React Flow v12:**
- Living Control Canvas (FR Growth): isolated module in `apps/web/modules/canvas/`
- Always-available 2D fallback list view in `apps/web/modules/canvas/fallback/`
- Canvas module loaded with `next/dynamic` + `{ ssr: false }` (canvas is client-only)
- Performance budget: canvas module bundle ≤200KB gzipped
- Decision: React Flow v12 as isolated module with mandatory 2D fallback

**Forms — React Hook Form + Zod:**
- Zod schemas defined in `packages/types`; shared between Fastify route validation and React Hook Form
- All forms use `useForm<z.infer<typeof schema>>` pattern
- Validation runs on blur (not on every keystroke); server-side errors mapped to field-level errors

---

### Infrastructure & Deployment

**LLM Provider — Anthropic Claude via GCP Vertex AI:**
- `claude-sonnet-4-6` for co-pilot queries (synchronous, <5s target), inline AI (FR53), task instruction generation (FR9)
- `claude-opus-4-7` for report generation (FR26), fingerprinting (FR1), regulatory change assessment (FR39) — async jobs, quality over speed
- All LLM calls via `packages/ai`; provider interface is abstract — swap Vertex AI for Anthropic direct API via config change
- Google Gemini via Vertex AI as fallback provider (same Vertex auth, config flag to switch)
- Evidence files never passed as raw text; structured metadata only; injection guard active in `packages/ai`
- Decision: Claude via Vertex AI; abstracted behind `packages/ai` provider interface

**CI/CD — GitHub Actions:**
- `apps/web` → Vercel auto-deploys on push to `main`; preview deploys on every PR
- `apps/api` and `apps/worker` → GitHub Actions: `turbo build --filter=apps/api` → Docker build → `gcloud run deploy`
- `packages/db` migrations → GitHub Actions: Prisma migrate deploy runs before Cloud Run deployment
- Turbo remote cache: Vercel Remote Cache for build acceleration across CI runs
- Decision: GitHub Actions for GCP deploys; Vercel native for `apps/web`

**Environments:**
- `local`: Docker Compose — Cloud SQL Proxy + Redis container + local Next.js + Fastify dev server
- `staging`: Dedicated GCP project; Cloud Run services with `--tag staging`; Vercel preview environment
- `production`: Dedicated GCP project; Cloud Run with min-instances=1 for API; Vercel production

**Observability:**
- **Sentry**: error tracking in `apps/web` (browser + server) and `apps/api`; source maps uploaded on deploy
- **GCP Cloud Logging**: structured JSON logs from all Cloud Run services and jobs; log-based metrics for SLA tracking
- **GCP Cloud Monitoring**: uptime checks, Cloud Run latency/error rate dashboards, Cloud SQL metrics
- **Axiom**: deferred — add if Cloud Logging query UX becomes a bottleneck at Growth scale

---

### Decision Impact Analysis

**Implementation Sequence (order matters):**
1. Turborepo monorepo init → `packages/config`, `packages/types`, `packages/db`
2. Cloud SQL instance + schema-per-tenant Prisma setup + migration pipeline
3. Clerk integration in `apps/api` (session middleware, webhook handler)
4. Core RBAC middleware in `apps/api`
5. `apps/web` Next.js shell with Clerk auth pages + BFF proxy layer
6. Evidence ingestion pipeline in `apps/worker` (SHA-256, Cloud Storage, Cloud Tasks)
7. SSE stream endpoint + Redis pub/sub in `apps/api`
8. `packages/ai` provider interface + Claude Vertex AI integration
9. Feature epics built on top of this foundation

**Cross-Component Dependencies:**
- `packages/types` Zod schemas → consumed by `apps/api` (validation) AND `apps/web` (forms) — must be consistent
- `packages/db` Prisma client → consumed by `apps/api` AND `apps/worker` — schema changes affect both
- `packages/ai` → consumed by `apps/worker` (async jobs) AND `apps/api` (synchronous co-pilot) — LLM interface must support both sync and async patterns
- Clerk webhook events → `apps/api` user sync → `packages/db` — user state must stay consistent across Clerk + local DB

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (PostgreSQL / Prisma):**
- Tables: `snake_case` plural — `control_items`, `evidence_blobs`, `audit_engagements`
- Columns: `snake_case` — `tenant_id`, `created_at`, `content_hash`
- Foreign keys: `{referenced_table_singular}_id` — `control_item_id`, `tenant_id`
- Indexes: `idx_{table}_{columns}` — `idx_control_items_tenant_id`
- Tenant schemas: `tenant_{uuid_no_hyphens}`

**API Endpoints (Fastify `/v1/`):**
- Resources: plural nouns, kebab-case — `/v1/controls`, `/v1/audit-engagements`, `/v1/evidence-items`
- Actions: verb on resource — `POST /v1/controls/:id/assign`, `POST /v1/audits/:id/close`
- Never verbs in path: ❌ `/v1/getControls` → ✅ `GET /v1/controls`
- Query params: `camelCase` — `?tenantId=`, `?pageSize=`, `?filterStatus=`

**TypeScript Code:**
- Variables/functions: `camelCase` — `tenantId`, `getControlHealth`
- Types/interfaces/enums/classes: `PascalCase` — `ControlItem`, `UserRole`
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_EVIDENCE_SIZE_MB`, `DEFAULT_POLL_INTERVAL_MS`
- React component files: `PascalCase` — `ControlCard.tsx`, `EvidenceBadge.tsx`
- Non-component files: `kebab-case` — `control-health.ts`, `evidence-ingestion.ts`
- Zod schemas: `{noun}Schema` suffix — `controlItemSchema`, `evidenceUploadSchema`

---

### Structure Patterns

**`apps/api` layout:** `routes/v1/` → `middleware/` → `services/` (business logic, no DB) → `repositories/` (Prisma only)

**`apps/web` layout:** `app/` (App Router pages) → `features/{domain}/` (components + hooks + queries.ts) → `modules/` (isolated heavy modules) → `components/` (global shared only)

**Tests:** Co-located `.test.ts` / `.test.tsx` next to source. Integration tests in `apps/api/tests/integration/`. No separate `__tests__/` directories.

**Shared code rule:** If two `apps/` need the same function → it lives in `packages/`. Never duplicated across apps.

---

### Format Patterns

**API success response:**
```typescript
{ data: T, meta?: { version: string } }                         // single resource
{ data: T[], meta: { total: number, cursor: string | null, pageSize: number } }  // collection
```

**API error response (all errors):**
```typescript
{ error: { code: string, message: string, details?: unknown } }
// code = machine-readable: "CONTROL_NOT_FOUND", "TIER_LIMIT_EXCEEDED"
// details = validation errors only; never stack traces
```

**HTTP status codes:** `200` success · `201` created · `204` deleted · `400` validation · `401` unauthenticated · `402` tier limit · `403` forbidden · `404` not found · `409` conflict · `429` rate limited · `500` internal

**Dates:** ISO 8601 strings in all API responses — `"2026-05-03T10:30:00Z"`. Never Unix timestamps.

**JSON field casing:** `camelCase` in all API responses and request bodies. Prisma `snake_case` mapped at serialization layer.

---

### Communication Patterns

**Cloud Tasks job naming:** `{tenantId}.{jobType}.{uuidv7}` — e.g. `abc123.fingerprint.01950cf3...`
Job types: `fingerprint` | `report-generate` | `evidence-sync` | `regulatory-scan` | `integration-poll`

**Redis pub/sub channels:**
- `tenant:{tenantId}:control-health` — control health state changes
- `tenant:{tenantId}:integration-health` — integration status changes
- `tenant:{tenantId}:job:{jobId}` — job completion events

**Domain events (worker → API via Redis pub/sub):**
- Naming: `{noun}.{past-tense-verb}` — `evidence.collected`, `control.degraded`, `integration.failed`, `report.generated`
- Payload always includes: `{ tenantId, occurredAt: ISO8601, ...domainFields }`

**SSE event envelope:**
```typescript
{ event: string, data: { tenantId: string, payload: unknown, timestamp: string } }
```

---

### Process Patterns

**Error handling:** All business errors thrown as `new AppError(code, message, statusCode)` from `packages/types`. Fastify `setErrorHandler` catches all; maps `AppError` → structured response; unknown → 500 + Sentry. Never `try/catch` individual DB calls unless transforming the error.

**Multi-tenant guard (every API handler, no exceptions):**
```typescript
// ✅ Correct — tenant from validated session context
const tenant = request.tenant  // set by tenant middleware

// ❌ Wrong — never trust path params for tenant resolution
const tenant = await getTenant(request.params.tenantId)
```

**Loading states (frontend):** Use TanStack Query `isLoading` / `isFetching` / `isError`. Never manual `useState<boolean>` for server data. Skeleton components for content; spinner only for action buttons.

**Async job pattern:**
1. API receives request → enqueues Cloud Task → returns `202 Accepted` with `{ jobId }`
2. Worker picks up task → updates Redis job state `in_progress`
3. Worker completes → Redis state `completed` + publishes domain event to pub/sub
4. SSE handler forwards event to client → TanStack Query invalidates relevant query

**Evidence immutability guard (worker, enforced in pipeline):**
```
SHA-256(file) → check evidence_blobs(content_hash)
  exists?   → create evidence_items pointing to existing blob (no upload)
  not found? → upload to Cloud Storage (Object Retention Lock) → insert evidence_blobs + evidence_items
Never write to existing blob. Never delete a blob.
```

**RBAC check pattern (every Fastify route):**
```typescript
fastify.get('/v1/controls', {
  preHandler: [authenticate, requireRole('ControlOwner'), requireTier('starter')]
}, handler)
// Both role AND tier checks required — never one without the other
```

---

### Enforcement Rules

**All AI agents MUST:**
1. Follow `{ data }` / `{ error: { code, message } }` API envelope — no exceptions
2. Use `request.tenant` for tenant resolution — never `request.params.tenantId`
3. Import types and Zod schemas from `packages/types` — never redefine in app code
4. Use TanStack Query for all server data — never `useEffect + fetch`
5. Pass only structured metadata to `packages/ai` — never raw file content to LLM
6. Apply both `requireRole` AND `requireTier` preHandlers on every protected route

## Project Structure & Boundaries

### Complete Project Directory Structure

```
grc/
├── .github/
│   └── workflows/
│       ├── ci.yml                     # Tests + lint on every PR
│       ├── deploy-api.yml             # Build + push → Cloud Run (apps/api)
│       └── deploy-worker.yml          # Build + push → Cloud Run Jobs (apps/worker)
├── turbo.json                         # Pipeline: build, test, lint, deploy
├── pnpm-workspace.yaml
├── package.json                       # Root: scripts, devDependencies
├── .env.example
│
├── apps/
│   ├── web/                           # Next.js 16 → Vercel
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/            # Sign-in, sign-up (Clerk hosted UI)
│   │   │   │   ├── (onboarding)/      # FR1-FR5: fingerprint + setup flow
│   │   │   │   │   ├── fingerprint/
│   │   │   │   │   └── setup/
│   │   │   │   ├── (app)/             # Authenticated app shell
│   │   │   │   │   ├── layout.tsx     # Shell: sidebar + top nav
│   │   │   │   │   ├── dashboard/     # FR10: real-time control pulse
│   │   │   │   │   ├── controls/      # FR6-FR12: control management
│   │   │   │   │   ├── evidence/      # FR13-FR19: evidence management
│   │   │   │   │   ├── audits/        # FR12, FR26-FR32: audit management
│   │   │   │   │   ├── risk/          # FR34, FR37: risk register + trajectory
│   │   │   │   │   ├── integrations/  # FR20-FR25: integration config
│   │   │   │   │   ├── reports/       # FR26-FR27: report viewer
│   │   │   │   │   ├── settings/      # FR40-FR49: admin settings
│   │   │   │   │   └── developer/     # FR50: developer portal
│   │   │   │   ├── (board)/           # FR45: board/exec portal (magic link)
│   │   │   │   ├── (auditor)/         # FR30-FR32: external auditor portal
│   │   │   │   ├── api/v1/            # BFF: proxy routes to Fastify API
│   │   │   │   └── layout.tsx         # Root layout (Clerk provider)
│   │   │   ├── features/
│   │   │   │   ├── controls/
│   │   │   │   │   ├── components/    # ControlCard, ControlHealthBadge, AssignModal
│   │   │   │   │   ├── hooks/         # useControlHealth, useAssignControl
│   │   │   │   │   └── queries.ts     # TanStack Query: controls.*
│   │   │   │   ├── evidence/
│   │   │   │   │   ├── components/    # EvidenceUpload, EvidenceThread, VersionHistory
│   │   │   │   │   ├── hooks/
│   │   │   │   │   └── queries.ts
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── components/    # ControlPulse, HealthSummary, TrajectoryScore
│   │   │   │   │   ├── hooks/
│   │   │   │   │   │   └── useHealthStream.ts   # SSE subscription hook
│   │   │   │   │   └── queries.ts
│   │   │   │   ├── audits/
│   │   │   │   ├── fingerprinting/    # FR1-FR3: confidence UI, source attribution
│   │   │   │   ├── risk/
│   │   │   │   ├── reports/
│   │   │   │   ├── integrations/
│   │   │   │   ├── auth/              # Clerk session helpers, role hooks
│   │   │   │   └── admin/
│   │   │   ├── modules/
│   │   │   │   └── canvas/            # React Flow (Growth, isolated module)
│   │   │   │       ├── index.tsx      # next/dynamic entry, ssr: false
│   │   │   │       ├── nodes/         # ControlNode, RiskNode, ProcessNode
│   │   │   │       ├── edges/
│   │   │   │       └── fallback/      # WCAG 2.1 AA 2D list view
│   │   │   └── components/
│   │   │       ├── layout/            # AppShell, Sidebar, TopNav
│   │   │       └── feedback/          # Toast, Skeleton, ErrorBoundary
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── api/                           # Fastify REST API → Cloud Run service
│   │   ├── src/
│   │   │   ├── server.ts              # Fastify instance + plugin registration
│   │   │   ├── routes/v1/
│   │   │   │   ├── controls.ts        # FR6-FR12
│   │   │   │   ├── evidence.ts        # FR13-FR19
│   │   │   │   ├── audits.ts          # FR12, FR26-FR32
│   │   │   │   ├── integrations.ts    # FR20-FR25
│   │   │   │   ├── reports.ts         # FR26-FR27
│   │   │   │   ├── risk.ts            # FR34, FR37
│   │   │   │   ├── fingerprint.ts     # FR1-FR3 (enqueue job, return jobId)
│   │   │   │   ├── assist.ts          # FR33, FR53: co-pilot + inline AI
│   │   │   │   ├── users.ts           # FR40-FR44
│   │   │   │   ├── billing.ts         # FR46
│   │   │   │   ├── export.ts          # FR47
│   │   │   │   ├── stream.ts          # SSE: /v1/stream (FR10 real-time)
│   │   │   │   ├── webhooks/
│   │   │   │   │   ├── clerk.ts       # Clerk user/org sync events
│   │   │   │   │   └── integrations.ts # Inbound integration webhooks (FR20-FR22)
│   │   │   │   └── developer/         # FR23-FR24, FR50: API keys, webhooks, sandbox
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts            # Clerk session validation
│   │   │   │   ├── tenant.ts          # schema_search_path injection
│   │   │   │   ├── rbac.ts            # requireRole() preHandler factory
│   │   │   │   └── tier-gate.ts       # requireTier() preHandler factory
│   │   │   ├── services/
│   │   │   │   ├── control.service.ts
│   │   │   │   ├── evidence.service.ts
│   │   │   │   ├── audit.service.ts
│   │   │   │   ├── report.service.ts
│   │   │   │   ├── integration.service.ts
│   │   │   │   ├── notification.service.ts    # FR35, FR36, FR41
│   │   │   │   ├── trajectory.service.ts      # FR34: rolling score computation
│   │   │   │   └── erasure-conflict.service.ts # GDPR erasure vs SOX retention
│   │   │   ├── repositories/
│   │   │   │   ├── control.repository.ts
│   │   │   │   ├── evidence.repository.ts
│   │   │   │   ├── audit.repository.ts
│   │   │   │   └── tenant.repository.ts
│   │   │   └── plugins/
│   │   │       ├── redis.ts
│   │   │       ├── rate-limit.ts
│   │   │       └── cors.ts
│   │   ├── tests/integration/
│   │   ├── Dockerfile
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── worker/                        # Async job processor → Cloud Run Jobs
│       ├── src/
│       │   ├── index.ts               # HTTP router: Cloud Tasks POSTs here
│       │   ├── jobs/
│       │   │   ├── fingerprint.job.ts
│       │   │   ├── report-generate.job.ts
│       │   │   ├── evidence-sync.job.ts
│       │   │   ├── regulatory-scan.job.ts
│       │   │   └── integration-poll.job.ts
│       │   ├── pipelines/
│       │   │   ├── evidence-ingestion/
│       │   │   │   ├── hash.ts
│       │   │   │   ├── deduplicate.ts
│       │   │   │   ├── store.ts       # Cloud Storage + Object Retention Lock
│       │   │   │   └── index.ts
│       │   │   └── report-assembly/
│       │   │       ├── gather-evidence.ts
│       │   │       ├── build-pdf.ts
│       │   │       └── index.ts
│       │   └── publishers/
│       │       └── health-events.ts   # Redis pub/sub domain event publisher
│       ├── Dockerfile
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── db/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── tenant-template.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── tenant-extension.ts
│   │   │   └── seed/
│   │   │       ├── frameworks.ts
│   │   │       └── controls.ts
│   │   └── package.json
│   │
│   ├── types/
│   │   ├── src/
│   │   │   ├── rbac.ts
│   │   │   ├── evidence.ts
│   │   │   ├── controls.ts
│   │   │   ├── audits.ts
│   │   │   ├── tenant.ts
│   │   │   ├── integrations.ts
│   │   │   ├── jobs.ts
│   │   │   ├── errors.ts
│   │   │   ├── api.ts
│   │   │   └── schemas/
│   │   │       ├── evidence.schema.ts
│   │   │       ├── control.schema.ts
│   │   │       └── audit.schema.ts
│   │   └── package.json
│   │
│   ├── ai/
│   │   ├── src/
│   │   │   ├── provider.ts
│   │   │   ├── vertex-ai.ts
│   │   │   ├── prompts/
│   │   │   │   ├── fingerprint.ts
│   │   │   │   ├── task-instructions.ts
│   │   │   │   ├── report.ts
│   │   │   │   ├── copilot.ts
│   │   │   │   ├── inline-assist.ts
│   │   │   │   └── regulatory.ts
│   │   │   └── guards/
│   │   │       ├── injection-guard.ts
│   │   │       └── metadata-only.ts
│   │   └── package.json
│   │
│   ├── ui/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   └── tokens/
│   │   └── package.json
│   │
│   └── config/
│       ├── eslint/index.js
│       ├── typescript/base.json
│       └── tailwind/base.ts
│
└── infra/
    ├── modules/
    │   ├── cloud-sql/
    │   ├── cloud-run/
    │   ├── cloud-tasks/
    │   ├── cloud-storage/
    │   ├── memorystore/
    │   └── secret-manager/
    └── environments/
        ├── staging/
        └── production/
```

### FR to Structure Mapping

| FR Range | Domain | Primary Location |
|---|---|---|
| FR1-FR3 | AI fingerprinting | `apps/web/features/fingerprinting/`, `apps/api/routes/v1/fingerprint.ts`, `apps/worker/jobs/fingerprint.job.ts`, `packages/ai/prompts/fingerprint.ts` |
| FR4-FR5 | Onboarding + framework preview | `apps/web/app/(onboarding)/`, `apps/api/routes/v1/controls.ts` |
| FR6-FR12 | Compliance & control management | `apps/web/features/controls/`, `apps/api/routes/v1/controls.ts`, `apps/api/services/control.service.ts` |
| FR13-FR19 | Evidence management | `apps/worker/pipelines/evidence-ingestion/`, `apps/api/routes/v1/evidence.ts`, `packages/db` |
| FR20-FR25 | Integration & connectivity | `apps/api/routes/v1/integrations.ts`, `apps/worker/jobs/evidence-sync.job.ts`, `apps/worker/jobs/integration-poll.job.ts` |
| FR26-FR29 | Audit management + reporting | `apps/api/routes/v1/audits.ts`, `apps/worker/pipelines/report-assembly/`, `packages/ai/prompts/report.ts` |
| FR30-FR32 | External auditor portal | `apps/web/app/(auditor)/`, `apps/api/routes/v1/audits.ts` (token endpoints) |
| FR33, FR53 | AI co-pilot + inline AI | `apps/api/routes/v1/assist.ts`, `packages/ai/prompts/copilot.ts`, `packages/ai/prompts/inline-assist.ts` |
| FR34-FR37 | Risk & regulatory intelligence | `apps/api/services/trajectory.service.ts`, `apps/api/routes/v1/risk.ts`, `apps/worker/jobs/regulatory-scan.job.ts` |
| FR38-FR39 | Ambient radar + regulatory agent | `apps/worker/jobs/regulatory-scan.job.ts`, `packages/ai/prompts/regulatory.ts` |
| FR40-FR45 | User & access management | `apps/api/routes/v1/users.ts`, `apps/api/middleware/rbac.ts`, Clerk + webhooks |
| FR46-FR51 | Platform admin + developer tools | `apps/api/routes/v1/billing.ts`, `apps/api/routes/v1/export.ts`, `apps/web/app/(app)/developer/` |
| FR52 | GRC time machine (Vision) | `packages/db` schema built from day 1; UI deferred to Phase 3 |

### Architectural Boundaries

**Request flow:** Browser → Vercel (`apps/web` BFF) → Cloud Run (`apps/api`) → Cloud SQL / Redis / Cloud Tasks

**Data boundaries:**
- Tenant data isolated in `tenant_{id}` PostgreSQL schemas — no cross-schema queries ever
- Evidence blobs: `gs://grc-evidence-prod/{tenantId}/{evidenceId}` — write-once, Object Retention Lock
- Evidence metadata: `evidence_items` table (tenant schema) — mutable, references blob by `content_hash`
- Secrets: GCP Secret Manager only — never in application database

**Integration points:**

| Direction | From | To | Auth |
|---|---|---|---|
| Inbound webhook | External system | `apps/api` webhook endpoint | HMAC signature |
| Outbound poll | `apps/worker` | External system API | Credentials from Secret Manager |
| Job enqueue | `apps/api` | Cloud Tasks | GCP service account |
| Job execution | Cloud Tasks | `apps/worker` HTTP | OIDC token |
| LLM call | `packages/ai` | Vertex AI (Claude) | Workload Identity |
| User events | Clerk | `apps/api` Clerk webhook | Clerk signature |

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All technology choices are mutually compatible.
- Next.js 16 + Tailwind v4 + shadcn/ui — confirmed compatible
- Fastify + Prisma v7 Client Extensions + Cloud SQL PostgreSQL — standard production pattern
- Clerk Node.js SDK works with Fastify via JWT verification hook
- TanStack Query + Zustand — no shared state conflicts; well-established pairing
- React Flow v12 loaded via `next/dynamic` (ssr: false) — avoids SSR hydration issues
- Claude via Vertex AI — same GCP Workload Identity auth as all other GCP services

**Pattern Consistency:** Naming conventions, error handling, API envelope, and multi-tenant guard are consistent across all three apps and all packages. `packages/types` shared Zod schemas prevent API ↔ form validation divergence.

**Structure Alignment:** The three-app split (`web`, `api`, `worker`) maps cleanly onto the three deployment targets (Vercel, Cloud Run service, Cloud Run Jobs). Package boundaries prevent duplication without circular dependencies.

### Requirements Coverage Validation

**All 53 FRs mapped** — every FR has a named file location. No FR is architecturally unaddressed.

| NFR Category | Architectural Coverage | Status |
|---|---|---|
| Performance | Redis caching for dashboard; async jobs for AI; SSE for real-time push; TanStack Query stale-while-revalidate | ✅ |
| Security | Clerk auth + custom RBAC + tier gates; SHA-256 immutability; Secret Manager; Sentry; pre-GA pen test required | ✅ |
| Scalability | Cloud Run auto-scaling; schema-per-tenant; Cloud Tasks horizontal worker scaling; AlloyDB upgrade path | ✅ |
| Reliability | Cloud Tasks dead-letter queues; Cloud Monitoring uptime checks; zero-downtime Cloud Run rolling deploys | ✅ |
| Accessibility | shadcn/ui (Radix UI) for all interactive components; React Flow with mandatory 2D fallback | ✅ |
| Data & Compliance | Cloud Storage Object Retention Lock (SOX 7yr); `erasure-conflict.service.ts`; EU Terraform region config | ✅ |

### Gap Analysis

**Critical Gaps:** None

**Minor Notes (non-blocking):**

1. **FR51 — Tamper-evident audit log**: Implement `platform_audit_logs` table in the public PostgreSQL schema — append-only (INSERT only, no UPDATE/DELETE grants). Columns: `(id, tenant_id, actor_id, action, resource_type, resource_id, ip_address, occurred_at)`. Cloud Logging export sink to Cloud Storage adds the off-platform tamper-evidence layer. Create this as the first migration.

2. **FR49 — Multi-BU scoping**: `business_units` table lives in tenant schema. All BU-scoped tables carry a nullable `business_unit_id` column. Single-BU tenants always have `business_unit_id = null`. Design into schema from day one; UI ships in Phase 2.

3. **FR52 — GRC time machine data model**: "Built from day 1" means appending to `control_health_snapshots` whenever any control health changes. Simple append on existing write path. UI and AI simulation engine deferred to Phase 3; the data collection is not.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

**16/16 items checked. No critical gaps.**

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**
**Confidence Level: High**

**Key Strengths:**
- Every FR has a named file in the structure — no ambiguity for implementation agents
- Schema-per-tenant fully specified with Prisma Client Extensions; tenant leakage prevented by pattern
- Evidence immutability pipeline architected end-to-end: hash → dedup → Object Retention Lock → metadata record
- `packages/ai` injection guards and metadata-only pattern address the primary LLM security failure mode
- Three minor notes documented with specific implementation guidance — all low-risk extensions of existing patterns

**Areas for Future Enhancement:**
- AlloyDB migration (trigger: Growth-scale query latency breach)
- WebSocket upgrade (trigger: Growth canvas collaboration ships)
- Axiom log aggregation (trigger: Cloud Logging query UX becomes bottleneck)
- Auditor firm multi-client portal (Phase 3 Vision)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and package boundaries
- Refer to this document for all architectural questions — it is the single source of truth

**First Implementation Priority:**
```bash
npx create-turbo@latest grc --package-manager pnpm
```
Then: provision Cloud SQL instance → set up Prisma schema-per-tenant → integrate Clerk → build core RBAC middleware → wire `packages/db` and `packages/types` before any feature work begins.
