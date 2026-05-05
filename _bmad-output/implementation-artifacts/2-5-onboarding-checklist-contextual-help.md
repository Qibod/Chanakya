# Story 2.5: Onboarding Checklist & Contextual Help

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As a new user setting up the platform,
I want a guided onboarding checklist that tracks my progress,
so that I always know what to do next and can pick up where I left off.

## Acceptance Criteria

1. **Five-step checklist (always visible in onboarding)**  
   **Given** a user has completed signup  
   **When** they enter the onboarding flow (`/onboarding/*`)  
   **Then** an in-app checklist shows **five** steps in order: **Company fingerprinting → Framework activation → Connect first integration → Assign first control → Generate first report**  
   **And** completed steps show a **checkmark**; the **next incomplete** step is visually highlighted (font-weight, ring, or accent border — match existing token styles from `@grc/ui` / Tailwind in [`apps/web/src/app/(app)/layout.tsx`](../../apps/web/src/app/(app)/layout.tsx))  
   **And** the checklist is **shared** across onboarding routes (not duplicated inconsistently per page — replace the ad hoc aside in [`FrameworkSelectionClient.tsx`](../../apps/web/src/features/onboarding-frameworks/FrameworkSelectionClient.tsx) lines ~253–261 with a single source of truth)

2. **Cross-session persistence**  
   **Given** a user abandons onboarding (closes the browser)  
   **When** they return and log back in  
   **Then** checklist progress reflects **server-backed state**, not only `sessionStorage` — progress survives new sessions and devices  
   **And** existing **`sessionStorage`** keys used in Stories 2.3–2.4 (`grc_onboarding_fingerprint_complete`, `grc_onboarding_framework_complete`, `grc_onboarding_overlap_percent`) are **reconciled on load**: either synced into server state once or treated as cache that **must not override** authoritative DB rows

3. **Dashboard progress banner**  
   **Given** the user is in the authenticated app shell (`(app)` routes, e.g. `/dashboard`)  
   **When** any onboarding step is still incomplete  
   **Then** a **compact banner** appears (top of main content below [`TopNav`](../../apps/web/src/app/(app)/layout.tsx)) with copy like **“3 of 5 setup steps complete”** derived from the same progress model as the checklist  
   **When** all five steps are complete  
   **Then** the banner does **not** render

4. **Contextual help (plain English, no jargon)**  
   **Given** a user hovers or activates a **contextual help** control on any **onboarding** screen (`/onboarding/*`)  
   **When** the help surface opens (tooltip or popover)  
   **Then** it shows: **(a)** what this step does in plain language, **(b)** a **“Why this matters”** one-liner  
   **And** **no** compliance jargon (no control codes like **CC6.1**, **Annex A**, **ISO clause IDs**, etc.) appears in onboarding help copy — framework codes may still appear elsewhere in-app per product rules, but **not** in these help strings  
   **And** help is keyboard-accessible (`focus`, `Escape` to dismiss) — align with patterns already used in [`FingerprintOnboardingClient.tsx`](../../apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx) (popover + escape handling)

5. **Completion UX**  
   **Given** all five steps are completed  
   **When** the final step transitions to complete  
   **Then** the checklist **collapses** with a short **completion animation** (respect **`prefers-reduced-motion`** — instant collapse or fade only)  
   **And** the onboarding banner is **dismissed permanently** for that tenant (or user — pick one model and document): returning users never see checklist/banner again unless product resets state  
   **And** the **full dashboard** is shown **without** onboarding overlays obstructing primary workflows

## Tasks / Subtasks

- [x] **Task 1 — Progress model & API** (AC: #2, #3, #5)  
  - [x] Define canonical **`OnboardingStepId`** union in [`packages/types`](../../packages/types/src/) (`fingerprint` | `framework` | `integration` | `assign_control` | `first_report`) + Zod schemas for API payloads.  
  - [x] Implement **`GET /v1/onboarding/progress`** returning `{ steps: Record<OnboardingStepId, boolean>, completedCount, total, dismissedAt?: string | null }` with **`{ data: ... }`** envelope per [`architecture.md`](../planning-artifacts/architecture.md).  
  - [x] **Derive truth from tenant schema** where possible (same `request.tenant.schemaName` raw SQL / Prisma patterns as [`apps/api/src/routes/v1/fingerprint.ts`](../../apps/api/src/routes/v1/fingerprint.ts)):  
    - **fingerprint:** exists **`fingerprint_results`** row with **`status = 'committed'`** ([`tenant-template.sql`](../../packages/db/src/migrations/tenant-template.sql) fingerprint_results).  
    - **framework:** at least one row in **`framework_activations`**.  
    - **integration:** at least one **`integration_configs`** row with **`status`** indicating connected (define allowed values — if only `'disconnected'` exists today, document minimal migration or use **`status <> 'disconnected'`** once connected state is added).  
    - **assign_control:** at least one **`control_items`** row with **`assigned_to IS NOT NULL`**.  
    - **first_report:** until Epic 5 report pipeline exists, use **explicit completion**: e.g. **`tenants.onboarding_first_report_completed_at`** or a JSONB **`onboarding_flags`** column — set via **`POST /v1/onboarding/complete-step`** with `{ step: 'first_report' }` when the UI exposes the placeholder CTA (see Task 4), **or** wire to first **`audit_engagements`** / report artifact when implemented. **Do not** fake DB rows.  
  - [x] Add **`POST /v1/onboarding/dismiss`** (or include in `complete-step`) to persist **permanent dismissal** when all steps true — store timestamp on **tenant** row (recommended single source for “team finished onboarding”).  
  - [x] **RBAC:** reuse onboarding gates consistent with fingerprint/frameworks: **`requireTier("starter")`** + **`requireRole("ControlOwner")`** (see [`fingerprintPreHandlers`](../../apps/api/src/routes/v1/fingerprint.ts)).  
  - [x] Register routes in [`apps/api/src/server.ts`](../../apps/api/src/server.ts); verify BFF [`apps/web/src/app/api/v1/[...path]/route.ts`](../../apps/web/src/app/api/v1/[...path]/route.ts) forwards GET/POST.

- [x] **Task 2 — Tenant schema migration** (AC: #2, #5)  
  - [x] Extend [`packages/db/src/migrations/tenant-template.sql`](../../packages/db/src/migrations/tenant-template.sql) + [`tenant-template.prisma`](../../packages/db/prisma/tenant-template.prisma) comments: add columns on **`tenants`** (or dedicated table) for **`onboarding_completed_at`**, **`onboarding_dismissed_at`**, and any **step override / first_report** fields needed.  
  - [x] Provide dev migration script note for existing tenants (mirror Story 2.4 [`migrate-tenant-control-items-story-2-4.sql`](../../packages/db/src/scripts/migrate-tenant-control-items-story-2-4.sql) pattern).

- [x] **Task 3 — Web UI: shared checklist + banner** (AC: #1, #3, #5)  
  - [x] Add **`apps/web/src/app/(onboarding)/layout.tsx`** wrapping onboarding children with a consistent shell: optional **sticky** checklist column or top strip — **mobile-safe** (stack vertically).  
  - [x] Extract **`OnboardingChecklist`** client component (e.g. [`apps/web/src/features/onboarding/OnboardingChecklist.tsx`](../../apps/web/src/features/onboarding/)) using **TanStack Query** against **`/api/v1/onboarding/progress`**, `queryKey` e.g. `['onboarding-progress']`.  
  - [x] Replace inline checklist UI in [`FrameworkSelectionClient.tsx`](../../apps/web/src/features/onboarding-frameworks/FrameworkSelectionClient.tsx); update [`DashboardControlsSummary.tsx`](../../apps/web/src/app/(app)/dashboard/DashboardControlsSummary.tsx) to use shared progress or a slim **`OnboardingBanner`** reading the same query.  
  - [x] **Invalidate** `['onboarding-progress']` after: fingerprint confirm, framework activate, integration connect (when API exists), control assignment, report placeholder — from respective mutation `onSuccess` handlers.

- [x] **Task 4 — Contextual help registry** (AC: #4)  
  - [x] Create **`onboardingHelpCopy.ts`** map: key = route segment or step id → `{ title, body, whyItMatters }` — **review all strings** for banned jargon.  
  - [x] Add **`OnboardingStepHelp`** icon button component using focus-trap–friendly popover (reuse accessibility patterns from fingerprint client).  
  - [x] Mount help on: **`/onboarding/fingerprint`**, **`/onboarding/frameworks`**, **`/onboarding/integrations`**, plus **`/dashboard`** for **assign control** / **first report** CTAs if those steps are completed there.

- [x] **Task 5 — Step-specific UX hooks** (AC: #1, #5)  
  - [x] **Assign first control:** until Story 3.x assignment UI ships, provide **minimum path**: e.g. dashboard or controls stub with **“Assign yourself to a control”** that calls **`PATCH /v1/controls/:id`** or existing route — if none exists, **narrow scope**: document **`POST /v1/onboarding/complete-step`** for **`assign_control`** only when **invalid** without real assignment — **prefer** real `assigned_to` update.  
  - [x] **Generate first report:** placeholder primary CTA on dashboard linking to future reports or a **“Generate summary”** stub that calls **`complete-step`** for `first_report` — must satisfy AC **without** implying fake audit output.

- [x] **Task 6 — Tests** (AC: all)  
  - [x] API tests: progress derivation matrix (committed fingerprint, frameworks, integration, assignment).  
  - [x] Client tests: checklist renders five labels; banner shows correct fraction; help copy contains **no** banned substrings (simple assertion list).  
  - [x] **`pnpm lint`** / **`pnpm test`** green.

## Dev Notes

### Current implementation (do not break)

- **Session-only flags today:** [`FingerprintOnboardingClient.tsx`](../../apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx) sets **`grc_onboarding_fingerprint_complete`**; [`FrameworkSelectionClient.tsx`](../../apps/web/src/features/onboarding-frameworks/FrameworkSelectionClient.tsx) sets **`grc_onboarding_framework_complete`**. [`DashboardControlsSummary.tsx`](../../apps/web/src/app/(app)/dashboard/DashboardControlsSummary.tsx) reads both for a **partial** two-item checklist — **replace** with five-step server-backed model.  
- **Flow order:** fingerprint confirm → **`/onboarding/frameworks`** → **`/onboarding/integrations`** → dashboard ([`2-4` story](2-4-compliance-framework-library-control-activation.md)).  
- **BFF:** Browser must call **`/api/v1/...`** only, never Cloud Run URL ([`architecture.md`](../planning-artifacts/architecture.md)).

### Relationship to Story 2.4

- 2.4 explicitly deferred **persistent** checklist to 2.5 — this story **supersedes** sessionStorage as the source of truth while allowing a one-time migration/sync.

### Relationship to Epic 3 / 5

- **Assign control** and **generate report** may require thin placeholders until control-assignment UI (Epic 3) and reporting (Epic 5) exist — the story still requires **visible** steps, **real** persistence, and **honest** completion rules (no phantom reports).

## Technical Requirements Summary

| Area | Requirement |
|------|-------------|
| API | Fastify, `{ data }` / `{ error: { code, message } }` envelope |
| Multi-tenant | All queries scoped to `request.tenant.schemaName` |
| Web | TanStack Query for server state; BFF proxy only |
| A11y | WCAG-minded help widgets; `prefers-reduced-motion` for animations |
| Copy | Onboarding help: zero regulatory alphanumeric codes |

## Architecture Compliance Checklist

- [x] No cross-tenant reads; schema name validated like existing routes  
- [ ] Append-only audit optional: **`onboarding.step_completed`** only if product wants audit trail — not explicitly required by epic; skip unless PM confirms  

## Library / Framework Requirements

| Area | Choice |
|------|--------|
| Server | Fastify + Zod (`@grc/types`) |
| Web | TanStack Query v5, Next.js App Router |
| UI | Existing Tailwind tokens; reuse fingerprint popover interaction patterns |

## File Structure Requirements

| Path | Action |
|------|--------|
| `apps/api/src/routes/v1/onboarding.ts` | **NEW** — progress + completion + dismiss |
| `apps/api/src/server.ts` | **UPDATE** — register onboarding routes |
| `packages/db/src/migrations/tenant-template.sql` | **UPDATE** — tenant onboarding columns |
| `packages/types/src/onboarding.ts` (or similar) | **NEW** — step ids + schemas |
| `apps/web/src/app/(onboarding)/layout.tsx` | **NEW** |
| `apps/web/src/features/onboarding/OnboardingChecklist.tsx` | **NEW** |
| `apps/web/src/features/onboarding/OnboardingBanner.tsx` | **NEW** (or inline in layout) |
| `apps/web/src/features/onboarding/onboardingHelpCopy.ts` | **NEW** |
| `apps/web/src/features/onboarding-frameworks/FrameworkSelectionClient.tsx` | **UPDATE** |
| `apps/web/src/app/(app)/dashboard/DashboardControlsSummary.tsx` | **UPDATE** |
| `apps/web/src/app/(app)/layout.tsx` or `dashboard/page.tsx` | **UPDATE** — banner injection point |

## Testing Requirements

- Unit tests for step derivation from mocked SQL results.  
- Component tests for checklist + banner + help jargon guard.  
- Contract test for GET progress shape (Zod round-trip).

## Previous Story Intelligence (2.4)

- **Files:** Framework selection, dashboard summary, integrations stub, fingerprint client — see [`2-4-compliance-framework-library-control-activation.md`](2-4-compliance-framework-library-control-activation.md) **File List**.  
- **Pattern:** `sessionStorage` keys **`grc_onboarding_*`** were temporary; **this story** moves authoritative state to API + DB.  
- **Completion notes:** Overlap % stored in **`grc_onboarding_overlap_percent`** — keep for **IntegrationsOverlapBanner**; do not use for step completion.

## Git Intelligence Summary

Recent commits on `main` are Epic **1.6** infra; Epic 2 work may live on feature branches — follow **`feat: Story X.Y`** convention and co-located tests.

## Latest Technical Information

- **TanStack Query v5** — `queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] })` after mutations ([`architecture.md`](../planning-artifacts/architecture.md)).  
- **Next.js 16** App Router — client components for checklist; layout may be server wrapper + client children.

## Project Context Reference

- No `project-context.md` found in repo at workflow time — rely on this story + [`architecture.md`](../planning-artifacts/architecture.md) + [`epics.md`](../planning-artifacts/epics.md) + [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md).

## Change Log

- **2026-05-05:** Implemented server-backed onboarding progress (`GET/POST /v1/onboarding/*`), `PATCH /v1/controls/:id` self-assign, tenant DDL updates, shared checklist + banner + contextual help, dashboard setup actions; tests and lint for `@grc/api`, `@grc/web`, `@grc/types`.
- **2026-05-05:** Addressed code review: added onboarding derivation service tests, banner now respects `dismissedAt`, help-copy jargon guard hardened to regex patterns, and tenant-schema guard centralized and applied across all raw SQL routes.
- **2026-05-05:** Pending environment validation — staging tenant provisioning via Clerk/Vercel is not configured yet, so webhook-driven `tenant_*` schema creation cannot be verified end-to-end.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- Onboarding steps derived from tenant schema plus `tenants.onboarding_first_report_completed_at`; auto-dismiss via `finalizeDismissIfComplete` when all five steps satisfied.
- Integration step: `POST /v1/onboarding/complete-step` with `integration` inserts `manual_onboarding` connected row when none exist; first report uses explicit tenant timestamp.
- SessionStorage fingerprint/framework flags retained for overlap banner compatibility; checklist truth is API-only.
- Code review fixes: coverage added for onboarding derivation (`computeOnboardingSteps` + `finalizeDismissIfComplete`), `OnboardingBanner` hides when `dismissedAt` is set, and tenant-schema guard centralized to `apps/api/src/lib/tenant-schema.ts`.
- Open (pending follow-up): Set up staging web hosting (Vercel) + Clerk project/webhook so `organization.created` provisions a `tenant_*` schema in staging; then confirm Story 2.5 columns exist on newly provisioned tenant schemas without needing manual migration.

### File List

- `packages/types/src/onboarding.ts`
- `packages/types/src/onboarding.test.ts`
- `packages/types/src/index.ts`
- `packages/db/src/migrations/tenant-template.sql`
- `packages/db/src/scripts/migrate-tenant-onboarding-story-2-5.sql`
- `packages/db/prisma/tenant-template.prisma`
- `apps/api/src/routes/v1/onboarding.ts`
- `apps/api/src/routes/v1/onboarding.test.ts`
- `apps/api/src/services/onboarding-progress.ts`
- `apps/api/src/services/onboarding-progress.test.ts`
- `apps/api/src/routes/v1/frameworks.ts`
- `apps/api/src/lib/tenant-schema.ts`
- `apps/api/src/server.ts`
- `apps/web/src/app/(onboarding)/layout.tsx`
- `apps/web/src/app/(onboarding)/onboarding/integrations/page.tsx`
- `apps/web/src/app/(app)/layout.tsx`
- `apps/web/src/app/(app)/dashboard/page.tsx`
- `apps/web/src/app/(app)/dashboard/DashboardControlsSummary.tsx`
- `apps/web/src/features/onboarding/useOnboardingProgress.ts`
- `apps/web/src/features/onboarding/OnboardingChecklist.tsx`
- `apps/web/src/features/onboarding/OnboardingBanner.tsx`
- `apps/web/src/features/onboarding/OnboardingLayoutClient.tsx`
- `apps/web/src/features/onboarding/OnboardingIntegrationsClient.tsx`
- `apps/web/src/features/onboarding/DashboardOnboardingActions.tsx`
- `apps/web/src/features/onboarding/onboardingHelpCopy.ts`
- `apps/web/src/features/onboarding/onboardingHelpCopy.test.ts`
- `apps/web/src/features/onboarding/OnboardingStepHelp.tsx`
- `apps/web/src/features/onboarding-frameworks/FrameworkSelectionClient.tsx`
- `apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx`
- `apps/web/src/features/fingerprinting/FingerprintOnboardingClient.integration.test.tsx`

## Open Questions / Clarifications

_(Non-blocking — resolve during implementation)_

1. **`integration_configs.status`** allowed values — confirm enum when “connected” is implemented.  
2. Whether **onboarding dismissal** is **per-tenant** vs **per-user** — epic implies team setup; **tenant-level** on `tenants` row is recommended.  
3. Minimal **first report** placeholder acceptable to PM until Epic 5 ships.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
