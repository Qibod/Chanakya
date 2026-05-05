# Story 3.1: Control Library — List View, Status & Domain Organisation

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As an Audit Director,
I want to view all controls organised by domain with live health status,
so that I can scan my compliance posture at a glance and know where to focus.

## Acceptance Criteria

1. **Given** an Audit Director navigates to `/controls`  
   **When** the control list loads  
   **Then** controls are grouped by domain with a collapsible section per domain  
   **And** each control row displays: control name, `FrameworkBadge`(s), `StatusChip` (pass/warn/fail/pending/auto), assigned owner avatar, and last-updated timestamp  
   **And** the list renders within 2 seconds under normal load (served from TanStack Query cache with stale-while-revalidate)

2. **Given** an Audit Director applies a filter (by framework, status, or owner)  
   **When** the filter chip is activated  
   **Then** the control list updates immediately using AND logic across active filters  
   **And** filter state persists within the session  
   **And** a "Clear all" link appears when any filter is active

3. **Given** an Audit Director clicks on a control row  
   **When** the selection fires  
   **Then** the `SidePanel` slides in from the right at `400px` width in 200ms  
   **And** the control list remains visible and scrollable behind the panel  
   **And** Escape closes the panel and returns focus to the triggering row

## Tasks / Subtasks

- [x] **Task 1 — Extend Controls API payload to support list view needs** (AC: #1, #2)  
  - [x] Update `GET /v1/controls` in [`apps/api/src/routes/v1/frameworks.ts`](../../../apps/api/src/routes/v1/frameworks.ts) to include the fields needed by the `/controls` UI:
    - `updatedAt` (ISO 8601) from `control_items.updated_at`
    - `assignedTo` (nullable) from `control_items.assigned_to`
  - [x] Keep API envelope consistent: `{ data: { total, items, nextCursor } }` and structured errors `{ error: { code, message, details? } }`.
  - [x] (If needed) add lightweight server-side filtering query params later, but for this story **client-side filtering is acceptable** because the UI already requests `limit=500`.

- [x] **Task 2 — Control list grouped by domain with collapsible sections** (AC: #1)  
  - [x] Update [`apps/web/src/features/controls/ControlLibraryClient.tsx`](../../../apps/web/src/features/controls/ControlLibraryClient.tsx) to:
    - Group `controlsQ.data` by `domain` (stable sort domains alphabetically; stable sort rows by `name` within domain).
    - Render each domain as a collapsible section (default: expanded).
    - Persist collapsed state for the session (Zustand is preferred by architecture, but local state is acceptable if contained to this page and non-shared).
  - [x] Ensure `prefers-reduced-motion` users still get an accessible, non-animated collapse/expand.

- [x] **Task 3 — Row content & UI elements** (AC: #1)  
  - [x] Replace the current simplified row UI (which only shows `{domain} · {status}`) with:
    - `FrameworkBadge` list (already present)
    - `StatusChip` from `@grc/ui` (map backend `status` string to `StatusChip` variants; unknown → `pending`)
    - **Assigned owner avatar**:
      - For now, a minimal avatar is acceptable: a 24–28px circle with initials + tooltip with owner id/name.
      - If an owner name is not available yet, show a neutral “Unassigned” chip/placeholder.
    - `last-updated` timestamp in compact form (relative for <7 days else absolute) per UX spec.
  - [x] Add `aria-label`s so each row is fully understandable to screen readers (status not color-only; avatar has label; timestamp announced).

- [x] **Task 4 — Filters (framework, status, owner) with AND logic + “Clear all”** (AC: #2)  
  - [x] Add filter chips above the list:
    - Framework filter reuses existing `frameworkScope` and the activated frameworks list.
    - Add `status` multi-select filter (pass/warn/fail/pending/auto).
    - Add `owner` filter: derive owner options from the loaded items’ `assignedTo` set (plus an explicit “Unassigned” option).
  - [x] Apply filters via a single `useMemo` pipeline over the fetched list (AND logic).
  - [x] Persist filter state in-session only (no localStorage requirement).

- [x] **Task 5 — Side panel must meet Story 3.1 interaction requirements** (AC: #3)  
  - [x] Verify the existing panel behavior in `ControlLibraryClient`:
    - Slides in/out with 200ms transition when motion is enabled (already implemented).
    - Escape closes and focus returns to the triggering row (already implemented via `openerRef` and keydown handler).
  - [x] Ensure the panel width is **exactly `400px` max** and does not regress on small viewports.

- [x] **Task 6 — Tests** (AC: all)  
  - [x] Update/extend [`apps/web/src/features/controls/ControlLibraryClient.test.tsx`](../../../apps/web/src/features/controls/ControlLibraryClient.test.tsx) to cover:
    - Domain grouping + collapse/expand
    - Filter AND logic (framework + status + owner)
    - “Clear all” resets filters
    - Escape closes panel and restores focus (use `@testing-library/user-event` focus assertions)
  - [x] Add API test coverage in `apps/api` if a test harness exists for routes; otherwise add focused unit coverage where feasible.

## Dev Notes

### What exists today (read this before changing anything)

- `/controls` route exists at [`apps/web/src/app/(app)/controls/page.tsx`](../../../apps/web/src/app/(app)/controls/page.tsx) and renders [`ControlLibraryClient`](../../../apps/web/src/features/controls/ControlLibraryClient.tsx).
- The UI currently:
  - Lists controls as a flat list (no domain grouping/collapse).
  - Shows `FrameworkBadge`(s) and a simple `{domain} · {status}` line.
  - Has a custom right-side panel implemented inline (not a shared `SidePanel` component).
- The backend endpoints already exist but are currently colocated in [`apps/api/src/routes/v1/frameworks.ts`](../../../apps/api/src/routes/v1/frameworks.ts):
  - `GET /v1/controls` returns `items` with `id`, `canonicalId`, `name`, `domain`, `status`, `framework`, `frameworkRefs`.
  - `GET /v1/controls/:id` returns `requirementDetails` used by the panel.

### Critical gaps this story must close

- **Domain grouping + collapse** is not implemented.
- **StatusChip / owner avatar / last-updated timestamp** are not rendered.
- **Filtering** by framework/status/owner is not implemented.
- API response does **not** currently include `updated_at` or `assigned_to`, so the UI cannot render `last-updated` or owner without extending the payload.

### Performance & data-fetching guardrails (do not regress)

- Keep TanStack Query as the only server-state mechanism on this page (no `useEffect + fetch`).
- Use memoization for derived lists (grouping, filters) to keep rendering snappy with up to 500 items.
- Do not introduce full-page loading spinners; use skeletons or small inline loading text as already done.

### UX consistency requirements (from `ux-design-specification.md`)

- Status must **not** be color-only: use `StatusChip` (icon + label) and keep text labels visible.
- Keyboard: Esc closes panel; focus returns to the triggering row; tab trapping in panel must remain intact.
- Motions respect `prefers-reduced-motion` (panel already does this; ensure collapse animations do too).

### References

- Story spec source: [`_bmad-output/planning-artifacts/epics.md`](../planning-artifacts/epics.md) → “Epic 3” → “Story 3.1”
- UI implementation to update:
  - [`apps/web/src/features/controls/ControlLibraryClient.tsx`](../../../apps/web/src/features/controls/ControlLibraryClient.tsx)
  - [`apps/web/src/app/(app)/controls/page.tsx`](../../../apps/web/src/app/(app)/controls/page.tsx)
- API routes likely to update:
  - [`apps/api/src/routes/v1/frameworks.ts`](../../../apps/api/src/routes/v1/frameworks.ts) (`GET /v1/controls`)
- Status chip component:
  - [`packages/ui/src/components/StatusChip.tsx`](../../../packages/ui/src/components/StatusChip.tsx)

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

### Completion Notes List

- ✅ Extended `GET /v1/controls` to return `assignedTo` and `updatedAt` for the control list UI.
- ✅ Implemented domain-grouped `/controls` list with collapsible sections and session-persisted collapsed state.
- ✅ Added `StatusChip`, minimal owner avatar/Unassigned badge, and “Last updated” display per row (with accessible labels).
- ✅ Added multi-filter chips (framework/status/owner) with AND logic and “Clear all”, persisted for the session.
- ✅ Added/updated tests for grouping, collapsing, AND filtering, and Escape-close focus restoration.
- ✅ Validated with `pnpm -r test`, plus web/api lint + type-check.
- ✅ Addressed review findings: updated canonical `@grc/types` schema for list controls, improved row-level screen-reader labeling, and fixed `PATCH /v1/controls/:id` to honor parsed body with tests.

### File List

- apps/api/src/routes/v1/frameworks.ts
- apps/api/src/routes/v1/frameworks.test.ts
- apps/api/src/routes/v1/dashboard.ts
- apps/web/src/features/controls/ControlLibraryClient.tsx
- apps/web/src/features/controls/ControlLibraryClient.test.tsx
- apps/web/src/features/dashboard/DashboardClient.tsx
- packages/types/src/frameworks-api.ts
- _bmad-output/implementation-artifacts/3-1-control-library-list-view-status-domain-organisation.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-05-05: Implemented Story 3.1 control library list UI + API payload extensions; added tests and validations.
- 2026-05-05: Addressed Senior Dev review changes (schema contract, a11y labeling, PATCH correctness).

