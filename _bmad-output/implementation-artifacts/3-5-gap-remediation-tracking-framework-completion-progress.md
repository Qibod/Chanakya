# Story 3.5: Gap Remediation Tracking & Framework Completion Progress

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As an **Audit Director**,
I want to track remediation progress and framework completion percentage in real time,
so that I can report on compliance status at any point in the audit cycle without manual counting.

## Acceptance Criteria

1. **Given** an Audit Director views any framework in the control library  
   **When** the framework view renders  
   **Then** a progress bar shows the framework completion percentage (passing controls / total controls × 100)  
   **And** the count of controls in each state (passing, needs attention, failing, pending) is displayed

2. **Given** a control status changes (e.g. evidence collected → passing)  
   **When** the status change event fires via SSE  
   **Then** the framework completion percentage updates in real time without a page reload  
   **And** the `ControlCard` for the affected domain reflects the new state within 5 seconds

3. **Given** an Audit Director clicks on a gap (amber or red control) in the framework view  
   **When** the `SidePanel` opens  
   **Then** it shows the control detail, current status, assigned owner (if any), due date (if set), and the specific remediation step required  
   **And** an "Assign" button is visible if the control has no owner — one click to fix the gap

4. **Given** an Audit Director wants a summary of all open gaps across all active frameworks  
   **When** they navigate to the Gaps view  
   **Then** all amber and red controls are listed sorted by severity (red first), with framework badge, domain, owner, and last-updated date  
   **And** the list can be exported as CSV

## Tasks / Subtasks

### Task 1 — Define “framework view” behavior on `/controls` (AC: #1, #3)

This codebase currently has a single control library page at `/controls` with framework filter chips (no dedicated `/frameworks/:id` page). Implement “framework view” as: **exactly one framework filter selected**.

- [x] **Update** `apps/web/src/features/controls/ControlLibraryClient.tsx` to detect when the selected framework filter resolves to exactly one framework.
- [x] When exactly one framework is selected, render a compact “Framework progress” section above the list:
  - progress bar with percentage \(passing / total\)
  - counts by status: `pass`, `warn` (“needs attention”), `fail`, `pending` (and optionally `auto`, but only if it doesn’t confuse the definition of “passing”)
- [x] Copy requirements:
  - Use “Needs attention” (amber) wording, consistent with dashboard language.
  - Keep it dense (Linear-style), not a giant hero. This is a power-user view (Audit Director).

### Task 2 — Establish the canonical completion definition (AC: #1)

Be explicit in code and API contract so the UI and exports are consistent.

- [x] Completion definition for this story (recommended):
  - **passing** = `status === "pass"` (optionally include `"auto"` if product definition treats auto-monitored as passing; if included, call this out in the progress label)
  - **needs attention** = `status === "warn"`
  - **failing** = `status === "fail"`
  - **pending** = `status === "pending"` (includes “not yet evidenced” / “in review” states)
- [x] Ensure this mapping is implemented once (shared helper), not duplicated across list view, gaps view, and CSV export.

### Task 3 — Real-time updates for progress metrics (AC: #2)

Do not invent a second realtime channel. Reuse the existing per-tenant control-health SSE stream created in Story 3.2.

- [x] **Reuse** `GET /v1/stream/control-health` (already exists per Story 3.2) to listen for `control.degraded` / `control.passed` events.
- [x] On any relevant SSE event, update the `/controls` TanStack Query cache:
  - simplest: `invalidateQueries` for the controls list query key(s)
  - preferred (if cheap): targeted `setQueryData` update for the affected control row so progress changes are immediate without refetching 500 items
- [x] Verify that the dashboard’s “domain card within 5 seconds” expectation remains true; do not degrade Story 3.2 behavior when adding more subscribers.

### Task 4 — Gap drill-down uses the existing SidePanel (AC: #3)

- [x] Clicking a gap control row opens the existing control `SidePanel` (same interaction as Story 3.1: 400px, Escape closes, focus restore).
- [x] Ensure `GET /v1/controls/:id` includes the information needed for the gap view:
  - assigned owner (if any) + due date (if any) (already in 3.3/3.4 patterns)
  - specific remediation step required:
    - MVP approach: reuse the assignment’s AI instruction text (if assigned) as the remediation step
    - if unassigned: show a short “Next step” placeholder and make “Assign” the primary action
- [x] Ensure “Assign” CTA is present when unassigned and uses the existing assignment flow from Story 3.3 (`POST /v1/controls/:id/assign`).

### Task 5 — Add a dedicated Gaps view (AC: #4)

There is no `/gaps` route today.

- [x] **Add** `apps/web/src/app/(app)/gaps/page.tsx` (AuditDirector-focused view).
- [x] **Add** `apps/web/src/features/gaps/GapsClient.tsx` to render:
  - a compact list/table of all `warn` + `fail` controls
  - sorted by severity: `fail` first, then `warn`
  - columns: control name, `FrameworkBadge`(s), domain, owner (or “Unassigned”), last updated
  - click row → open `SidePanel` (no navigation)
- [x] Filters (optional, only if cheap and consistent with `/controls` patterns):
  - framework chip filter
  - owner filter
  - “Unassigned only”

### Task 6 — Backend read model for gaps (supports Gaps view + CSV) (AC: #4)

Avoid forcing the UI to always download every control and then filter; the Gaps view should be fast and direct.

- [x] **Add** `GET /v1/gaps` to `apps/api/src/routes/v1/` (suggest: `apps/api/src/routes/v1/gaps.ts`).
- [x] RBAC:
  - require auth + tenant middleware
  - require `AuditDirector` role (OrgAdmin satisfies via role hierarchy, if implemented)
- [x] Response envelope: `{ data: { items: GapItem[] } }`
- [x] `GapItem` (minimum):
  - `controlId: string`
  - `name: string`
  - `domain: string`
  - `status: "warn" | "fail"`
  - `frameworks: { key: string; name: string }[]` (enough to render `FrameworkBadge` list)
  - `assignedTo: string | null`
  - `dueDate: string | null` (`YYYY-MM-DD`)
  - `updatedAt: string` (ISO 8601)
- [x] Sorting:
  - server returns pre-sorted: `fail` first then `warn`, then by `updatedAt` desc (or due date asc if present — pick one and keep consistent).

### Task 7 — CSV export (AC: #4)

- [x] Implement CSV export for the Gaps view with a deterministic, human-friendly schema:
  - columns (minimum): `frameworks`, `domain`, `controlName`, `status`, `owner`, `dueDate`, `lastUpdated`
- [x] Export must reflect the current filters/sort order.
- [x] Implementation can be client-side (generate blob + download) unless there is already an export route pattern to reuse.

### Task 8 — Tests (API + Web) (AC: all)

- [x] API tests:
  - `GET /v1/gaps`: 401 unauthenticated; 403 wrong role; 200 returns only warn/fail items; sorted correctly; tenant isolation enforced.
- [x] Web tests:
  - `/controls` with one framework selected shows progress bar + counts.
  - SSE event triggers progress update without a page reload (mock EventSource; invalidate query).
  - `/gaps` shows fail-first sorting and exports CSV with expected header columns.
  - Clicking a row opens SidePanel; Escape closes and restores focus.

### Review Findings

- [ ] [Review][Patch] `FRAMEWORK_LIBRARY_META[id as FrameworkId].title` crashes on unknown framework IDs — if a stored `framework_refs` value contains an ID not present in `FRAMEWORK_LIBRARY_META`, the property access throws a runtime TypeError. Fix: use optional chaining `FRAMEWORK_LIBRARY_META[id as FrameworkId]?.title ?? id` to safely fall back to the raw ID. [`apps/api/src/routes/v1/gaps.ts:67`]
- [ ] [Review][Patch] `updatedAt` fallback fabricates `new Date().toISOString()` for null timestamps — controls with a null `updated_at` appear as last-updated "now" in the Gaps table and CSV export. Fix: return `null` and update the `GapItem` type to `updatedAt: string | null`; display `"—"` in the UI column. [`apps/api/src/routes/v1/gaps.ts:72-76`]
- [ ] [Review][Patch] `FrameworkBadge` receives `f.key as never` — explicit type suppression masks a real type mismatch between `string` and `FrameworkId`. Fix: type `GapItem.frameworks[].key` as `FrameworkId` in both the API response and `GapsClient`, removing the need for the cast. [`apps/web/src/features/gaps/GapsClient.tsx:145`]
- [ ] [Review][Patch] `GapsClient` has no SSE subscription — when a control is remediated while `/gaps` is open, the list does not update in real time. Task 3 spec requires real-time updates. Fix: add an `EventSource('/api/v1/stream/control-health')` subscription in a `useEffect` and call `qc.invalidateQueries({ queryKey: ["gaps-list"] })` on `control.degraded`/`control.passed` events. [`apps/web/src/features/gaps/GapsClient.tsx`]
- [ ] [Review][Patch] "Assign" button shown even when control already has an owner — AC3 says the button is visible only "if the control has no owner". Currently `showAssign={true}` renders the Assign button unconditionally, creating a confusing UI where both "Assign" and "Assigned to: X" appear simultaneously. Fix: wrap the Assign button in a conditional `{showAssign && !detailQ.data?.assignment?.assignedTo ? ...}` or pass an `unassigned` prop. [`apps/web/src/features/controls/ControlSidePanel.tsx:248-259`]
- [ ] [Review][Patch] `/gaps` page has no AuditDirector role gate — a ControlOwner navigating directly to `/gaps` sees the page render (then a 403 error from the API) with no redirect. Fix: add a server-side role check or middleware that redirects non-AuditDirectors to `/my-tasks` or `/dashboard`, consistent with the pattern in `/my-tasks/page.tsx`. [`apps/web/src/app/(app)/gaps/page.tsx`]
- [x] [Review][Defer] `GET /v1/gaps` returns all warn/fail items with no pagination — acceptable at MVP scale; add cursor pagination when control counts at tenant scale grow large.
- [x] [Review][Defer] `csvEscape` does not handle `\r` (carriage return) — RFC 4180 requires quoting values containing `\r`; add to the quoted-value condition.
- [x] [Review][Defer] `exportCsv` DOM `<a>` element not cleaned up on error — if `a.click()` throws, `URL.revokeObjectURL` is never called. Wrap in try/finally or use `setTimeout(() => URL.revokeObjectURL(url), 100)`.

## Dev Notes

### Story source of truth

- `_bmad-output/planning-artifacts/epics.md` → “Epic 3” → “Story 3.5”
- UX constraints: `_bmad-output/planning-artifacts/ux-design-specification.md` (D1+D2 shell principles, SidePanel interaction, status semantics, a11y)
- Architecture constraints: `_bmad-output/planning-artifacts/architecture.md` (SSE, TanStack Query patterns, API envelope, tenant isolation, RBAC)

### What exists today (do not reinvent)

- Control library list + SidePanel:
  - `apps/web/src/app/(app)/controls/page.tsx`
  - `apps/web/src/features/controls/ControlLibraryClient.tsx`
- Assignment flow (one-click “Assign” is already defined):
  - API: `POST /v1/controls/:id/assign` (Story 3.3)
  - UI: side panel assignment modal in `ControlLibraryClient`
- Real-time control health SSE stream:
  - `apps/api/src/routes/v1/stream.ts` includes dashboard stream endpoints (Story 3.2)
  - Do not break the existing fingerprinting jobs stream (`/v1/stream/jobs/:jobId`)
- API shape rules (non-negotiable):
  - Success: `{ data: ... }`
  - Error: `{ error: { code, message, details? } }`

### Architecture guardrails (must follow)

- **Tenant isolation**: always resolve tenant from `request.tenant` server-side; never from path params or client headers.
- **RBAC**: enforce on every route; client checks are decorative only.
- **Frontend server state**: TanStack Query v5; no `useEffect + fetch` loops for read models.
- **Accessibility**: status is never color-only; `StatusChip`/labels required; keyboard/focus behavior must match established SidePanel behavior.

### References

- Implemented patterns to mirror:
  - `_bmad-output/implementation-artifacts/3-1-control-library-list-view-status-domain-organisation.md`
  - `_bmad-output/implementation-artifacts/3-2-real-time-compliance-dashboard-d1d2-shell.md`
  - `_bmad-output/implementation-artifacts/3-3-control-assignment-ai-generated-task-instructions.md`

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

### Completion Notes List

 - ✅ Added `GET /v1/gaps` (AuditDirector-gated) and wired it into `apps/api` server.
 - ✅ Implemented framework progress readout on `/controls` when a single framework is selected.
 - ✅ Reused existing per-tenant SSE control-health stream to refresh control metrics in real time.
 - ✅ Added `/gaps` view with CSV export and SidePanel drill-down (including one-click Assign).
 - ✅ All workspace tests pass (`pnpm -r test`).

### File List

- apps/api/src/routes/v1/gaps.ts
- apps/api/src/routes/v1/gaps.test.ts
- apps/api/src/server.ts
- apps/web/src/app/(app)/gaps/page.tsx
- apps/web/src/components/layout/Sidebar.tsx
- apps/web/src/features/controls/ControlLibraryClient.tsx
- apps/web/src/features/controls/ControlLibraryClient.test.tsx
- apps/web/src/features/controls/ControlSidePanel.tsx
- apps/web/src/features/gaps/GapsClient.tsx
- apps/web/src/features/gaps/GapsClient.test.tsx
- apps/web/src/lib/control-status.ts

