# Story 2.4: Compliance Framework Library & Control Activation

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As a user completing onboarding,
I want to activate compliance frameworks and see a pre-populated unified control library,
So that I can start managing compliance without building my control set from scratch.

## Acceptance Criteria

1. **Framework library screen**  
   **Given** the user reaches the framework selection step  
   **When** the framework library page loads  
   **Then** five frameworks are available: **SOC 2**, **ISO 27001**, **SOX**, **GDPR**, **NIST CSF** — each showing a short description, **control count** (from the canonical catalog), and whether it is **Recommended** based on committed fingerprint inference  
   **And** frameworks inferred as relevant from fingerprint **`regulatoryObligations` / `riskDomains` / `industryClassification`** (see Recommendation rules) show a **Recommended** badge and are **pre-selected** in the UI where tier limits allow  

2. **Activation writes tenant state**  
   **Given** the user activates one or more frameworks (within tier limits)  
   **When** activation is confirmed  
   **Then** rows are inserted into tenant **`framework_activations`** for each activated framework (with `activated_by` = current user id)  
   **And** **`control_items`** are populated for the unified library so that controls mapping to the **same canonical control** across multiple selected frameworks are stored **once**, with **all applicable framework references** available for UI (`FrameworkBadge` list — see Data model)  
   **And** new controls use **`status`** aligned with product types: **`pending`** (no evidence yet), matching `ControlStatus` in [`packages/types/src/controls.ts`](../../packages/types/src/controls.ts) — do **not** leave rows at generic `not_started` if the epic/dashboard contract is `pending`  

3. **Cross-framework overlap summary**  
   **Given** at least two frameworks are active (Growth/Scale) or the catalog defines overlaps  
   **When** activation completes  
   **Then** the UI shows **overlap percentage**: *“X% of your controls are shared across your active frameworks”* — computed as  
   \(\lfloor 100 \times \frac{\text{canonical controls with } \geq 2 \text{ framework refs}}{\text{total distinct canonical controls activated}} \rfloor\)  
   (define denominator carefully when Starter has only one framework — show **N/A** or hide line if &lt; 2 frameworks active)  

4. **Starter tier — preview & limits (PRD)**  
   **Given** the tenant tier is **Starter** ([`SubscriptionTier.starter`](../../packages/types/src/rbac.ts))  
   **When** the framework selection screen renders  
   **Then** the user may have **at most 1** actively selected / activatable framework at confirm time (**PRD:** “1 active + preview of others”)  
   **And** frameworks **not** chosen as that one show as **locked / read-only preview**: control count + **estimated gaps** (use a documented heuristic or static table per framework until product replaces it)  
   **And** clicking a locked framework opens an **upgrade prompt** (Growth tier) — **not** a hard paywall that blocks navigation; align with UX **conversion without sales call**  

5. **Growth / Scale tier limits**  
   **Given** tier is **Growth**  
   **When** selecting frameworks  
   **Then** enforce **up to 3** concurrent selections / activations per PRD  
   **Given** tier is **Scale**  
   **Then** **unlimited** selections per PRD  

6. **Post-activation routing & dashboard**  
   **Given** framework activation completes successfully  
   **When** the user is routed forward  
   **Then** they land on **`/dashboard`** (or the established app home for compliance overview) with populated controls visible at least in summary form **OR** a clear empty-state if dashboard UI is still stubbed — **minimum:** dashboard loads without error and **TanStack Query** (when wired) can fetch controls  
   **And** **onboarding checklist** shows **“Framework activated ✓”** as completed — use the same **sessionStorage / lightweight flags** pattern as Story 2.3 (`grc_onboarding_*`) until Story 2.5 persists checklist server-side; document keys  

## Tasks / Subtasks

- [x] **Task 1 — Canonical framework & control catalog** (AC: #1–#3)  
  - [x] Define canonical framework ids consistent with [`packages/ui/src/components/FrameworkBadge.tsx`](../../packages/ui/src/components/FrameworkBadge.tsx): `SOC2`, `ISO27001`, `SOX`, `GDPR`, `NIST_CSF` and human-readable copy for the five frameworks.  
  - [x] Author a **seed catalog** (e.g. `packages/db/src/catalog/` or `packages/types/src/catalog/`) mapping **canonical control id** → display name, domain, and **per-framework control codes** for overlap detection. Start with a **minimal but honest** set per framework (enough to demo counts and overlap — expand later).  
  - [x] Implement **pure function** `computeRecommendedFrameworks(inference: FingerprintInferencePayload): FrameworkId[]` using keyword / phrase matching on obligation titles and risk text (document rules; keep deterministic for tests).  

- [x] **Task 2 — Tenant schema / types for multi-framework controls** (AC: #2, #3)  
  - [x] Extend tenant DDL ([`packages/db/src/migrations/tenant-template.sql`](../../packages/db/src/migrations/tenant-template.sql)) + [`tenant-template.prisma`](../../packages/db/prisma/tenant-template.prisma) comments so each `control_items` row can represent **one canonical control** with **multiple framework references** (e.g. `framework_refs` JSONB / `text[]`, or child table `control_item_framework_tags`). Must support Story 3.1 `ControlItem.frameworkRefs` shape.  
  - [x] Add Zod types + exports in `@grc/types` for activation request/response and list payloads.  
  - [x] Provide **provision / migrate** path for existing dev schemas (script or doc in story completion notes).  

- [x] **Task 3 — API routes** (AC: #2, #4, #5)  
  - [x] Add **`apps/api/src/routes/v1/frameworks.ts`** (or `controls.ts` per [`architecture.md`](../../planning-artifacts/architecture.md) FR mapping):  
    - `GET /v1/frameworks/library` — catalog metadata, counts, tier-aware locks, optional `recommended[]` derived server-side from latest **committed** `fingerprint_results` row for tenant.  
    - `POST /v1/frameworks/activate` — body: `{ frameworkIds: FrameworkId[] }`; validate tier max; transactional insert into `framework_activations` + bulk insert merged `control_items`; idempotent behaviour if called twice (define: reject duplicate activation vs no-op — **prefer 409** on duplicate framework).  
  - [x] **RBAC / tier:** reuse [`requireTier("starter")`](../../apps/api/src/middleware/rbac.ts) + [`requireRole`](../../apps/api/src/middleware/rbac.ts) appropriate for onboarding (**ControlOwner** or **OrgAdmin** — align with fingerprint routes).  
  - [x] **Audit:** append-only [`platform_audit_logs`](../../packages/db/prisma/schema.prisma) entry e.g. `framework.activated` with `resource_type` + summary (framework ids), **no** large JSON payloads in audit row.  

- [x] **Task 4 — BFF** (AC: #2)  
  - [x] Verify [`apps/web/src/app/api/v1/[...path]/route.ts`](../../apps/web/src/app/api/v1/[...path]/route.ts) proxies new GET/POST methods.  

- [x] **Task 5 — Web UI** (AC: #1, #3, #4, #6)  
  - [x] New route: **`/onboarding/frameworks`** under [`apps/web/src/app/(onboarding)/`](../../apps/web/src/app/(onboarding)/) with a client component using **TanStack Query** for `GET /api/v1/frameworks/library` and mutations for activate.  
  - [x] Presentation: cards or list with `FrameworkBadge`, Recommended badge, control count, Starter locked states, overlap summary after success.  
  - [x] **Onboarding flow order:** After Story 2.3, users currently land on [`/onboarding/integrations`](../../apps/web/src/app/(onboarding)/onboarding/integrations/page.tsx). **Update** confirm success navigation in [`FingerprintOnboardingClient.tsx`](../../apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx) to **`/onboarding/frameworks`** first; framework completion **then** navigates to **`/onboarding/integrations`** (epic order: fingerprint → framework activation → integration setup).  
  - [x] Persist **`jobId`** in `sessionStorage` on fingerprint confirm (if not already) so the library page can call `GET /v1/fingerprint/:jobId` for inference when `/library` does not embed recommendations.  

- [x] **Task 6 — Dashboard hook** (AC: #6)  
  - [x] Minimal **`GET /v1/controls`** (or extend frameworks response) so dashboard / future 3.1 can list controls; at least return count + sample rows for QA.  

- [x] **Task 7 — Tests** (AC: all)  
  - [x] Unit: `computeRecommendedFrameworks`, overlap %, tier validation pure functions.  
  - [x] API: activate happy path, Starter exceeding 1 framework → **400/402** with clear code, duplicate activation → **409**.  
  - [x] Component: library renders locks for Starter; mutation success navigates.  

## Dev Notes

### Relationship to Story 2.3

- Confirmed fingerprint payload lives in **`fingerprint_results.data`** (committed). Use it for **Recommended** badges; do **not** duplicate business logic from confirm merge — read committed JSON only.  
- **Redirect chain:** fingerprint confirm → **`/onboarding/frameworks`** → **`/onboarding/integrations`** → dashboard when user chooses “continue” from framework step (adjust 2.3 redirect).  

### Relationship to Story 2.5

- Persistent checklist lives in 2.5; for 2.4 use **sessionStorage** flags (e.g. `grc_onboarding_framework_complete`) plus optional checklist UI snippet so AC “Framework activated ✓” is visible.  

### Relationship to Story 2.6

- Full **cross-framework mapping engine** and detail-panel requirement references are **2.6**. For **2.4**, implement **catalog-based** canonical deduplication and overlap **percentage** only; avoid building a general-purpose mapper beyond the seed catalog.  

### UX & product

- [`ux-design-specification.md`](../../planning-artifacts/ux-design-specification.md): framework chips, clarity-first; no jargon in **onboarding** help text (2.5 handles deep help).  
- **Starter conversion:** locked frameworks show value (counts + estimated gaps) per [`prd.md`](../../planning-artifacts/prd.md) § Framework preview.  

### Technical Requirements Summary

| Area | Requirement |
|------|-------------|
| API | Fastify, `{ data: ... }` / `{ error: { code, message } }` envelope |
| Multi-tenant | All SQL via `request.tenant.schemaName`; never cross-schema |
| Web | BFF only; TanStack Query for server state |
| DB | `framework_activations` UNIQUE(`framework`) — one row per framework key per tenant |

### Architecture Compliance Checklist

- [x] Browser → Next BFF → Fastify → tenant schema ([`architecture.md`](../../planning-artifacts/architecture.md))  
- [x] TanStack Query + Zustand; no `useEffect`+fetch for server data  
- [x] Append-only audit log for activation events  

### Library / Framework Requirements

| Area | Choice |
|------|--------|
| UI badges | `@grc/ui` `FrameworkBadge` |
| Validation | Zod in `@grc/types` |
| API | Fastify + existing auth/tenant middleware |

### File Structure Requirements

| Path | Action |
|------|--------|
| `apps/api/src/routes/v1/frameworks.ts` | **NEW** (or `controls.ts` if matching architecture naming) |
| `apps/api/src/app.ts` or route registrar | **UPDATE** — register routes |
| `packages/db/src/migrations/tenant-template.sql` | **UPDATE** — control_items / tags |
| `packages/types/src/*.ts` | **UPDATE** — activation + catalog types |
| `apps/web/src/app/(onboarding)/onboarding/frameworks/page.tsx` | **NEW** |
| `apps/web/src/features/onboarding-frameworks/` (suggested) | **NEW** — UI + queries |
| `apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx` | **UPDATE** — post-confirm redirect target |

### Testing Requirements

- Deterministic unit tests (no DB) for recommendation + overlap math.  
- API integration tests following [`apps/api/src/routes/v1/fingerprint.test.ts`](../../apps/api/src/routes/v1/fingerprint.test.ts) patterns.  
- No Vertex/Redis required for catalog GET if fingerprint optional for tests (mock tenant inference).  

## Previous Story Intelligence (2.3)

- **Files touched:** [`packages/types/src/fingerprint-confirm.ts`](../../packages/types/src/fingerprint-confirm.ts), [`apps/api/src/routes/v1/fingerprint.ts`](../../apps/api/src/routes/v1/fingerprint.ts), [`FingerprintOnboardingClient.tsx`](../../apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx), [`onboarding/integrations/page.tsx`](../../apps/web/src/app/(onboarding)/onboarding/integrations/page.tsx).  
- **Patterns:** `fingerprintPreHandlers` = `requireTier("starter")` + `requireRole("ControlOwner")`; jobId prefix guard `${tenantId}.fingerprint.`.  
- **Explicit follow-up:** Integrations stub is minimal; **framework step should precede it** in UX flow after this story.  

## Git Intelligence Summary

Recent `main` history is Stories **1.x** infrastructure; Epic 2 work may live on a feature branch — follow existing **`feat: Story X.Y`** commit convention and co-located tests.  

## Latest Technical Information

- **TanStack Query v5** — use `useMutation` + `queryClient.invalidateQueries` after activation ([`architecture.md`](../../planning-artifacts/architecture.md)).  
- **Tier order** — [`TIER_ORDER`](../../packages/types/src/rbac.ts): starter &lt; growth &lt; scale.  

## Project Context Reference

- No `project-context.md` found in repo at workflow time — rely on this story + [`architecture.md`](../../planning-artifacts/architecture.md) + [`epics.md`](../../planning-artifacts/epics.md).  

## Dev Agent Record

### Agent Model Used

Cursor agent (GPT-5.2)

### Debug Log References  

_(none)_

### Completion Notes List  

- **Code review (2026-05-05):** Feedback from `2-4-review-2026-05-05.md` addressed — shared `auditIpFromRequest` (trusted `request.ip` with `trustProxy`; no hand-parsed `X-Forwarded-For`), tenant migration backfill `not_started` → `pending`, `ON CONFLICT (canonical_id)` narrowed to `framework_refs` + `updated_at` only, Postgres `23505` → **409** `FRAMEWORK_ALREADY_ACTIVE`, Scale cap = catalog size, GIN on `framework_refs`, library query uses `data <> '{}'::jsonb`, `GET /v1/controls` keyset pagination + `total`/`nextCursor`, adversarial recommendation regex (SOX/GDPR-style), overlap sessionStorage cleared on new fingerprint submit, dashboard token classes, `aria-pressed` on framework cards, expanded route tests (audit shape, re-activation merge, pagination). Full suite green: `pnpm test`, `pnpm lint`, `pnpm type-check`.
- Implemented canonical catalog, recommendations, overlap math, and API activation with merged `control_items` (`canonical_id`, `framework_refs`, `domain`, default `pending`).
- Onboarding flow: fingerprint confirm → `/onboarding/frameworks` → `/onboarding/integrations`; overlap % surfaced via `IntegrationsOverlapBanner` + sessionStorage.
- Dashboard uses TanStack Query on `GET /api/v1/controls` and sessionStorage checklist flags.
- Legacy tenant schemas: optional SQL at [`packages/db/src/scripts/migrate-tenant-control-items-story-2-4.sql`](../../packages/db/src/scripts/migrate-tenant-control-items-story-2-4.sql) (replace `TENANT_SCHEMA`).

### File List  

- `packages/types/src/framework-catalog.ts`
- `packages/types/src/framework-catalog.test.ts`
- `packages/types/src/frameworks-api.ts`
- `packages/types/src/frameworks-api.test.ts`
- `packages/types/src/index.ts`
- `packages/db/src/migrations/tenant-template.sql`
- `packages/db/prisma/tenant-template.prisma`
- `packages/db/src/scripts/migrate-tenant-control-items-story-2-4.sql`
- `apps/api/src/lib/audit-ip.ts`
- `apps/api/src/lib/audit-ip.test.ts`
- `apps/api/src/routes/v1/frameworks.ts`
- `apps/api/src/routes/v1/frameworks.test.ts`
- `apps/api/src/server.ts`
- `apps/api/tests/integration/tenant-isolation.test.ts`
- `apps/web/src/app/(onboarding)/onboarding/frameworks/page.tsx`
- `apps/web/src/features/onboarding-frameworks/FrameworkSelectionClient.tsx`
- `apps/web/src/features/onboarding-frameworks/FrameworkSelectionClient.test.tsx`
- `apps/web/src/app/(onboarding)/onboarding/integrations/page.tsx`
- `apps/web/src/app/(onboarding)/onboarding/integrations/IntegrationsOverlapBanner.tsx`
- `apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx`
- `apps/web/src/features/fingerprinting/FingerprintOnboardingClient.integration.test.tsx`
- `apps/web/src/app/(app)/dashboard/page.tsx`
- `apps/web/src/app/(app)/dashboard/DashboardControlsSummary.tsx`

## Change Log

- **2026-05-05:** Code review follow-up completed; story marked **done** in sprint tracking (`sprint-status.yaml`).
- **2026-05-05:** Story 2.4 implemented — framework library API, tenant control schema, onboarding UI, dashboard controls summary, tests (`pnpm test`, `pnpm lint`).

---

## Open Questions / Clarifications

_(Non-blocking — resolve during implementation)_  

1. Exact **estimated gaps** formula for locked frameworks (static vs % of control count).  
2. Whether **NIST CSF** abbreviation in UI must always read **“NIST CSF”** (matches `FrameworkBadge`).  
3. Minimum **canonical catalog** size acceptable for demo vs empty-state.  

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
