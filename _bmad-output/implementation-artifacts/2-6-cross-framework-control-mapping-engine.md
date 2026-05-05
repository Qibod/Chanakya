# Story 2.6: Cross-Framework Control Mapping Engine

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As an Audit Director managing multiple compliance frameworks,
I want the system to automatically surface controls shared across my active frameworks,
So that my team manages each control once instead of maintaining duplicate entries.

## Acceptance Criteria

1. **Unified library list (multi-framework)**  
   **Given** two or more frameworks are active for a tenant  
   **When** the user views the **control library** (authenticated `/controls` — new minimal page; sidebar already links here)  
   **Then** each row represents **one** `control_items` row (canonical unified control) with a **`FrameworkBadge`** per applicable framework derived from `framework_refs` (parse `FRAMEWORK:code` segments; dedupe frameworks)  
   **And** rows where `framework_refs` encode **≥2 distinct frameworks** are visually identifiable as **shared** (e.g. subtle label “Shared across frameworks” or icon — match `@grc/ui` tokens)

2. **Per–framework “Shared controls” counter**  
   **Given** the user filters or switches **framework context** (tabs, segmented control, or dropdown scoped to an activated framework — pick one pattern and reuse across the page)  
   **When** framework **F** is selected  
   **Then** show **Shared controls: N** where **N** = count of unified controls that **include F** in their mapping **and** satisfy **≥2** distinct frameworks in `framework_refs` (same definition as overlap numerator in Story 2.4, scoped to F)

3. **Control detail — requirement references**  
   **Given** a control is shared (e.g. SOC 2 + ISO 27001)  
   **When** the Audit Director opens **control detail** (right **`SidePanel`** 400px / 200ms — [Source: `ux-design-specification.md` §2.5 dashboard interaction pattern]; wire from list row focus + Escape to close)  
   **Then** the panel lists **each mapped framework** with its **specific requirement reference**: human-readable framework label (reuse `FrameworkBadge` / `FRAMEWORK_LIBRARY_META` titles) + clause/code (e.g. **SOC 2** → `CC6.1`, **ISO 27001** → `A.9.2`) — parsed from `framework_refs` strings  
   **And** copy clarifies that **one evidence upload** applies to all listed requirements (single `control_items` row / shared evidence model)

4. **Incremental activation — mapping runs + notification**  
   **Given** a tenant **already** has ≥1 active framework and **adds** another via **`POST /v1/frameworks/activate`** (Story 2.4)  
   **When** activation succeeds  
   **Then** the server **re-runs** canonical merge (`mergeCanonicalControlsForFrameworks` in [`packages/types/src/framework-catalog.ts`](../../packages/types/src/framework-catalog.ts)) for the **union** of active frameworks — already implemented in transaction; **extend the response** (or add a dedicated summary field) with:  
   - **`alreadyCoveredCount`**: number of **canonical controls** required by the **newly activated** framework(s) in this request whose **`canonical_id` already existed** in `control_items` **before** this transaction (pre-merge query) — this matches epic language *“X controls from [new framework] are already covered by your existing controls”*  
   - **`frameworkLabel`**: short human title for the new framework (from `FRAMEWORK_LIBRARY_META`) for notification copy  
   **And** the web client shows a **non-blocking notification** (toast or dismissible banner; respect **`prefers-reduced-motion`**) when `alreadyCoveredCount > 0`, e.g. **“{X} controls from {Framework} are already covered by your existing controls.”**  
   **When** `alreadyCoveredCount === 0`, **do not** show the notification

5. **Evidence model (no duplicate upload)**  
   **Given** shared controls as above  
   **When** evidence is associated with a `control_item_id` (future Epic 4 paths; no new evidence pipeline required in 2.6 unless already stubbed)  
   **Then** document in dev notes: evidence remains keyed to **one** `control_items.id`; satisfy epic AC by **data model + copy** — no second row per framework

## Tasks / Subtasks

- [x] **Task 1 — Pure functions & types** (AC: #2, #4)  
  - [x] Add typed helpers in `@grc/types` (near [`framework-catalog.ts`](../../packages/types/src/framework-catalog.ts)): parse `framework_refs` JSON → structured `{ frameworkId, code }[]`; **shared count per framework**; **alreadyCoveredForNewFrameworks(preCanonicalIds, newFrameworkIds, mergedCatalog)** or equivalent deterministic definition documented in JSDoc.  
  - [x] Unit tests: golden cases from `CANONICAL_CONTROLS` overlap (e.g. `c-access-logical` SOC2+ISO27001).

- [x] **Task 2 — API** (AC: #3, #4)  
  - [x] **`GET /v1/controls/:id`** in [`apps/api/src/routes/v1/frameworks.ts`](../../apps/api/src/routes/v1/frameworks.ts) (or split `controls.ts` if file exceeds clarity — follow existing registration in [`server.ts`](../../apps/api/src/server.ts)): return full control row + normalized **`frameworkRefs`** + **`requirementDetails`** for panel (server-side parsing ensures one contract).  
  - [x] Extend **`POST /v1/frameworks/activate`** response `data` with `alreadyCoveredCount` (and optional `perFramework` breakdown if useful for tests). Compute **before** inserts using existing canonical ids from DB vs incoming merge for **new** `frameworkIds` only.  
  - [x] Zod schemas in `@grc/types` for new response fields; keep **`{ data }` / `{ error }`** envelope ([`architecture.md`](../planning-artifacts/architecture.md)).

- [x] **Task 3 — Web — `/controls` library + panel** (AC: #1–#3)  
  - [x] Add [`apps/web/src/app/(app)/controls/page.tsx`](../../apps/web/src/app/(app)/controls/page.tsx) (or equivalent route group): client list using TanStack Query **`['controls-list']`** with optional **`frameworkFilter`** query param or local state.  
  - [x] Reuse **`GET /api/v1/controls`** pagination; map rows to **`FrameworkBadge`** list; implement framework scoping UI + **Shared controls: N** subtitle.  
  - [x] **`SidePanel`** (or existing shell panel if present): fetch **`GET /api/v1/controls/:id`** on row activate; show requirement list; focus trap + Escape.

- [x] **Task 4 — Activation notification** (AC: #4)  
  - [x] In [`FrameworkSelectionClient.tsx`](../../apps/web/src/features/onboarding-frameworks/FrameworkSelectionClient.tsx) (or single activation mutation wrapper), read extended response; show toast/banner **once** on success when `alreadyCoveredCount > 0`; invalidate **`['controls-list']`**.

- [x] **Task 5 — Tests** (AC: all)  
  - [x] API tests: activation returns correct `alreadyCoveredCount` when second framework overlaps catalog; GET control by id 404/200.  
  - [x] Component: framework filter updates shared count; a11y basics for panel.

## Dev Notes

### Current implementation (extend, do not break)

- **Merge engine:** `mergeCanonicalControlsForFrameworks` + **`ON CONFLICT (canonical_id) DO UPDATE`** on `framework_refs` — [`apps/api/src/routes/v1/frameworks.ts`](../../apps/api/src/routes/v1/frameworks.ts) lines ~145–181. Story 2.6 **does not replace** this; it **surfaces** mapping in UI + **metrics** on incremental activate.  
- **List API:** `GET /v1/controls` returns `frameworkRefs` array — sufficient for badges on list; detail endpoint adds normalized parsing once for panel consistency.  
- **No `GET /v1/controls/:id` today** — **must add** for AC #3 (dashboard only PATCH-assigns).  
- **Sidebar:** [`Sidebar.tsx`](../../apps/web/src/components/layout/Sidebar.tsx) already navigates to **`/controls`** — page may be missing or 404; **deliver** minimal library here for this story.  
- **Overlap %:** Story 2.4 [`computeOverlapPercent`](../../packages/types/src/framework-catalog.ts) — reuse concepts; **shared count per framework** is a **scoped** variant of overlap counting.

### Relationship to Story 2.4 & 2.5

- **2.4** explicitly deferred full **mapping engine UI + detail** to **2.6** — see [`2-4-compliance-framework-library-control-activation.md`](2-4-compliance-framework-library-control-activation.md) “Relationship to Story 2.6”.  
- **2.5** onboarding progress & checklist — when implementing notifications, **invalidate** `['onboarding-progress']` only if product ties activation to onboarding (optional); **do** invalidate controls query.

### Relationship to Epic 3.1

- Epic **3.1** adds full domain grouping, filters, and production-grade list UX. **2.6** delivers **minimal** compliant library + shared semantics so Epic 3 can **elevate** layout without redoing mapping logic.

## Technical Requirements Summary

| Area | Requirement |
|------|-------------|
| API | Fastify; Zod validation; tenant `schemaName` on all SQL ([`architecture.md`](../planning-artifacts/architecture.md)) |
| RBAC | Same as frameworks routes: **`frameworksPreHandlers`** (`requireTier("starter")` + **`requireRole("ControlOwner")`**) unless PM expands reader roles — **default: match existing controls GET** |
| Web | BFF `/api/v1/*` only; TanStack Query v5 |
| A11y | Panel: Escape closes; focus return to row; live region optional for notification |

## Architecture Compliance Checklist

- [x] Schema-per-tenant queries only; validate schema name before interpolation ([`TENANT_SCHEMA_NAME_RE`](../../apps/api/src/routes/v1/frameworks.ts))  
- [x] No cross-tenant reads  
- [ ] Optional: append **`mapping.incremental`** or extend **`framework.activated`** audit payload with counts — **only if** audit table allows; do not log large JSON

## Library / Framework Requirements

| Area | Choice |
|------|--------|
| UI | `@grc/ui` **`FrameworkBadge`**, semantic Tailwind tokens (`var(--…)`) |
| Types | `@grc/types` — keep parsing deterministic for tests |
| Server | Existing Prisma + `$queryRawUnsafe` patterns |

## File Structure Requirements

| Path | Action |
|------|--------|
| [`packages/types/src/framework-catalog.ts`](../../packages/types/src/framework-catalog.ts) (or sibling) | **UPDATE** — parsing + counting helpers |
| [`apps/api/src/routes/v1/frameworks.ts`](../../apps/api/src/routes/v1/frameworks.ts) | **UPDATE** — GET `:id`, activate response |
| [`apps/api/src/routes/v1/frameworks.test.ts`](../../apps/api/src/routes/v1/frameworks.test.ts) | **UPDATE** |
| [`apps/web/src/app/(app)/controls/page.tsx`](../../apps/web/src/app/(app)/controls/page.tsx) | **NEW** |
| [`apps/web/src/features/controls/`](../../apps/web/src/features/) (suggested) | **NEW** — list + panel components |
| [`apps/web/src/features/onboarding-frameworks/FrameworkSelectionClient.tsx`](../../apps/web/src/features/onboarding-frameworks/FrameworkSelectionClient.tsx) | **UPDATE** — post-activate toast |

## Testing Requirements

- Pure functions: matrix of framework combinations vs expected shared counts and `alreadyCoveredCount`.  
- API: inject tenant schema fixtures via existing test patterns in [`frameworks.test.ts`](../../apps/api/src/routes/v1/frameworks.test.ts).  
- UI: smoke + a11y for panel open/close.

## Previous Story Intelligence (2.5)

- **Server-backed onboarding** — sessionStorage keys (`grc_onboarding_*`) are **secondary**; checklist uses **`GET /v1/onboarding/progress`**. Any activation UX should **invalidate** relevant queries.  
- **Files:** See [`2-5-onboarding-checklist-contextual-help.md`](2-5-onboarding-checklist-contextual-help.md) **File List** for onboarding touchpoints.  
- **Controls PATCH:** Self-assign uses **`PATCH /v1/controls/:id`** — preserve behaviour.

## Previous Story Intelligence (2.4)

- **`framework_refs`** JSONB holds **string[]** like **`SOC2:CC6.1`** — sorted in merge; **`primaryFramework`** / **`control_code`** columns are **informational** ordering ([`MergedControlRow`](../../packages/types/src/framework-catalog.ts)).  
- **409** `FRAMEWORK_ALREADY_ACTIVE` on duplicate activation — incremental adds must use **only new** `frameworkIds`.  
- **Completion notes:** GIN on `framework_refs`, pagination on list — use **`nextCursor`** for large tenants when building library.

## Git Intelligence Summary

Recent `main` history in repo shows Epic **1.x** merges; Epic 2 work may live on feature branches — follow **`feat: Story 2.6`** convention and co-located tests.

## Latest Technical Information

- **TanStack Query v5** — `queryClient.invalidateQueries({ queryKey: ['controls-list'] })` after activation.  
- **Next.js 16** App Router — client components for interactive list/panel.

## Project Context Reference

- No `project-context.md` found in repo at workflow time — rely on this story + [`architecture.md`](../planning-artifacts/architecture.md) + [`epics.md`](../planning-artifacts/epics.md) + [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md).

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- Implemented `computeIncrementalCoverage`, ref parsing, shared counts, and `formatNewFrameworksLabel` in `@grc/types`; extended `POST /v1/frameworks/activate` with `alreadyCoveredCount`, `frameworkLabel`, and `coverageBreakdown`; added `GET /v1/controls/:id` with `requirementDetails`.
- Added `/controls` page with `ControlLibraryClient` (framework scope chips, shared counter, detail panel, Escape to close, evidence copy).
- Framework activation shows dismissible toast when `alreadyCoveredCount > 0`, with shorter delay when `prefers-reduced-motion: reduce`.
- **AC5 (evidence):** Evidence remains attached to a single `control_items.id`; detail panel states one upload satisfies all listed framework requirements (Epic 4 will attach by `control_item_id` only).
- **Code review follow-ups (2026-05-05):** Made activation coverage notice non-blocking (persist via sessionStorage and render on integrations step), added focus trap + focus restoration in the SidePanel, fixed slide animation (`translate-x-full → translate-x-0`), subscribed to reduced-motion changes, parallelized activation pre-reads via `Promise.all`, and set audit `resourceId` to newly-activated frameworks only. Re-ran `pnpm test` + `pnpm lint` green.

### File List

- `packages/types/src/framework-catalog.ts`
- `packages/types/src/framework-catalog.test.ts`
- `packages/types/src/frameworks-api.ts`
- `apps/api/src/routes/v1/frameworks.ts`
- `apps/api/src/routes/v1/frameworks.test.ts`
- `apps/web/src/app/(app)/controls/page.tsx`
- `apps/web/src/features/controls/ControlLibraryClient.tsx`
- `apps/web/src/features/controls/ControlLibraryClient.test.tsx`
- `apps/web/src/features/onboarding-frameworks/FrameworkSelectionClient.tsx`

## Change Log

- **2026-05-05:** Story 2.6 implemented — cross-framework mapping UI, incremental activation coverage API, activation toast, tests (`pnpm test`, `pnpm lint` green).
- **2026-05-05:** Addressed code review requested changes (non-blocking coverage notice, panel focus management, activation pre-read parallelization, audit resourceId semantics); tests/lint re-verified green.

## Open Questions / Clarifications

_(Non-blocking — resolve during implementation)_

1. **Audit Director role:** Routes currently use **`ControlOwner`** — confirm with PM if **`AuditDirector`** should read **`GET /v1/controls`** without role change.  
2. **Toast library:** Use existing app pattern if one exists; otherwise minimal **`aria-live`** region + dismiss button.  
3. **Epic 3.1 timing:** If `/controls` page grows large before 3.1, keep components **split** so domain grouping can slot in later.

---

**Completion note:** Implementation complete — `pnpm test` and `pnpm lint` passed; story marked **review**.
