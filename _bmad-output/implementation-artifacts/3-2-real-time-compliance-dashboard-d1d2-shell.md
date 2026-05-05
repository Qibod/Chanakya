# Story 3.2: Real-Time Compliance Dashboard — D1+D2 Shell

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Audit Director,  
I want a live compliance dashboard that answers "are we on track?" without requiring any clicks,  
so that I can complete my daily check-in in under 60 seconds.

## Acceptance Criteria

1. **Given** an Audit Director navigates to `/dashboard`  
   **When** the page loads  
   **Then** the `HealthSummaryBar` renders at the top with four metrics: passing count + weekly delta, attention count, failing count, and trajectory score placeholder  
   **And** data is served from Redis cache — no API call on navigation after the first load (stale-while-revalidate, 30s TTL)

2. **Given** the dashboard domain grid renders  
   **When** it is displayed on a ≥1280px viewport  
   **Then** eight `ControlCard` components are arranged in a `repeat(4, 1fr)` CSS grid  
   **And** each card shows: domain name, pass rate %, control count, `ECGPulse` sparkline (30-day history pre-computed server-side), `StatusChip`, and the top amber/red item with a specific inline action if any exist  
   **And** all-green domains display no inline action — the absence of action is the success state

3. **Given** a control health change event fires (via integration or manual update)  
   **When** the SSE stream pushes a `control.degraded` or `control.passed` event  
   **Then** the affected `ControlCard` re-renders with the new status within 5 seconds of the event  
   **And** the `HealthSummaryBar` counts update without a full page reload  
   **And** `aria-live="polite"` on the summary bar region announces the count change to screen readers

4. **Given** a domain card has a red (failing) control  
   **When** the card renders  
   **Then** the specific failing control name is surfaced inline with a "Fix now" button and an "Assign" button  
   **And** clicking "Fix now" opens the `SidePanel` for that control — no page navigation

5. **Given** the right panel action feed renders  
   **When** items are displayed  
   **Then** failing items are expanded by default with action buttons visible  
   **And** passing items are collapsed — ambient green signal only  
   **And** the feed polls every 30 seconds and also updates on SSE push events

## Tasks / Subtasks

- [x] **Task 1 — Implement D1+D2 dashboard layout + primary components** (AC: #1, #2, #4, #5)  
  - [x] Update the placeholder page at [`apps/web/src/app/(app)/dashboard/page.tsx`](../../../apps/web/src/app/(app)/dashboard/page.tsx) to render the actual D1+D2 shell (three-column grid on ≥1280px).  
  - [x] Implement (or wire up existing) UI components consistent with UX spec:
    - `HealthSummaryBar` (top, `aria-live="polite"` region wrapper)
    - Domain grid of 8 `ControlCard`s (4 columns ≥1280px, 3 columns 1024–1279px, 2 columns 768–1023px)
    - Right panel action feed (collapsible on smaller viewports if required by existing layout patterns)
  - [x] Ensure the “no click required” property: dashboard answers health summary + what needs attention with no interaction.

- [x] **Task 2 — Dashboard data contract + cache semantics** (AC: #1, #2, #5)  
  - [x] Add a single dashboard read model endpoint (BFF or Fastify) that returns everything needed for:
    - Health summary counts + weekly delta
    - 8 domain cards (pass rate, count, status, top red/amber item, sparkline points)
    - Action feed items (ranked; failing expanded by default)
  - [x] Implement “cache-first” semantics as specified:
    - Redis-backed cache on the server (per-tenant keys, TTL ~30s as per architecture)
    - Client uses TanStack Query v5 with stale-while-revalidate so revisiting `/dashboard` does not show a full loading state after first load
  - [x] Do not regress the architecture rules:
    - tenant must come from `request.tenant` server-side (never trust path params for tenant resolution)
    - API envelope must remain `{ data: ... }` and errors `{ error: { code, message, details? } }`

- [x] **Task 3 — SSE stream for control health events (dashboard)** (AC: #3, #5)  
  - [x] Implement a tenant-scoped SSE endpoint for dashboard health events (architecture target is a per-tenant stream).  
  - [x] Preserve the existing job SSE endpoint at [`apps/api/src/routes/v1/stream.ts`](../../../apps/api/src/routes/v1/stream.ts) (currently `/v1/stream/jobs/:jobId`) — **do not break fingerprint streaming**.
  - [x] Ensure correct RBAC:
    - Audit Director (and any other allowed dashboard roles) can subscribe to the dashboard stream
    - Existing job stream remains gated as it is today unless changed by a separate story
  - [x] Event envelope must follow architecture:
    - SSE `event: control.degraded` / `control.passed`
    - `data: { tenantId, payload, timestamp }` JSON
  - [x] Client wiring:
    - Use `EventSource` on the client to subscribe
    - On event: update TanStack Query cache (targeted `setQueryData` / `invalidateQueries`), do not full reload

- [x] **Task 4 — “Fix now” opens SidePanel (no navigation)** (AC: #4)  
  - [x] Reuse the established SidePanel interaction from Story 3.1 (`/controls` list) if possible:
    - width 400px, escape closes, focus restoration to opener
  - [x] “Fix now” must open the side panel for the specific control surfaced in the card.

- [x] **Task 5 — Accessibility + reduced motion guardrails** (AC: #3, plus UX spec)  
  - [x] Status is never color-only: use `StatusChip` (icon + label) for summary + cards.
  - [x] Ensure `aria-live="polite"` for summary count changes and updates are not overly chatty.
  - [x] Respect `prefers-reduced-motion` for any animated transitions (panels, feed expand/collapse, etc.).

- [x] **Task 6 — Tests** (AC: all)  
  - [x] Add/update web tests to cover:
    - dashboard renders health summary + 8 cards from a mocked query response
    - “Fix now” opens SidePanel without navigation
    - SSE event updates cached data (simulate EventSource messages)
  - [x] Add/update API tests (if harness exists) for SSE endpoint shape and RBAC gating.

## Dev Notes

### Story source of truth

- Story spec source: [`_bmad-output/planning-artifacts/epics.md`](../planning-artifacts/epics.md) → “Epic 3” → “Story 3.2”
- UX constraints source: [`_bmad-output/planning-artifacts/ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) (notably D1+D2 Combined Shell and accessibility requirements)
- Architecture constraints source: [`_bmad-output/planning-artifacts/architecture.md`](../planning-artifacts/architecture.md)

### What exists today (read before changing anything)

- `/dashboard` currently renders a placeholder:
  - [`apps/web/src/app/(app)/dashboard/page.tsx`](../../../apps/web/src/app/(app)/dashboard/page.tsx)
  - It intentionally says: “Live posture and feeds ship in Story 3.2…”
- There is an existing small “controls summary” query component:
  - [`apps/web/src/app/(app)/dashboard/DashboardControlsSummary.tsx`](../../../apps/web/src/app/(app)/dashboard/DashboardControlsSummary.tsx)
  - It fetches `/api/v1/controls?limit=500` with TanStack Query.
- There is an onboarding helper panel on dashboard that calls `/api/v1/controls/:id` PATCH and a placeholder onboarding step endpoint:
  - [`apps/web/src/features/onboarding/DashboardOnboardingActions.tsx`](../../../apps/web/src/features/onboarding/DashboardOnboardingActions.tsx)
  - Be careful not to break these onboarding affordances unless replacing them intentionally.
- There is an SSE endpoint today, but it is **jobs-only** (fingerprinting job stream) and gated as ControlOwner:
  - [`apps/api/src/routes/v1/stream.ts`](../../../apps/api/src/routes/v1/stream.ts) exposes `GET /v1/stream/jobs/:jobId`
  - It subscribes to Redis pub/sub channel `tenant:{tenantId}:job:{jobId}`
  - This must remain working after Story 3.2.

### Architecture guardrails (non-negotiable)

- **Tenant isolation**: server resolves tenant from `request.tenant` only; never trust client tenant IDs.
- **API envelope**: success `{ data: ... }`; errors `{ error: { code, message, details? } }`.
- **Frontend data**: TanStack Query v5 for server-state; avoid `useEffect + fetch` patterns for dashboard data.
- **Real-time**: SSE is the chosen mechanism; upgrade to WebSocket is explicitly deferred.
- **Redis**: per-tenant cache keys and pub/sub channels; do not create cross-tenant channels/keys.

### Cache semantics clarification (how to interpret “no API call on navigation after first load”)

This is a UX requirement, not a literal “no network ever”. Implement it as:
- client shows cached dashboard data immediately on revisit (TanStack Query cache + server Redis cache)
- background refresh is allowed (30s polling and/or SSE-driven invalidation)
- no full-page “loading” state on revisit after first success

### Open questions saved for end (do not block story creation)

- What are the exact domain list and ordering for the “8 cards” (likely 8 control domains)? Ensure the backend read model defines them deterministically.
- What is the desired rank ordering heuristic for action feed items (severity + staleness + due date)? Use a simple default unless already defined elsewhere.

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

### Completion Notes List

- ✅ Added dashboard read-model endpoint with Redis cache (`GET /v1/dashboard`, 30s TTL).
- ✅ Implemented dashboard UI shell with health summary, domain grid, and action feed.
- ✅ Added tenant SSE stream for control health events (`GET /v1/stream/control-health`) and wired client `EventSource` invalidation.
- ✅ “Fix now” opens a 400px slide-in SidePanel with Escape close and focus restoration.
- ✅ All tests/lint/type-check pass (`pnpm test`, `pnpm lint`, `pnpm type-check`).

### File List

- apps/web/src/app/(app)/dashboard/page.tsx
- apps/web/src/features/onboarding/DashboardOnboardingActions.tsx
- apps/web/src/features/dashboard/DashboardClient.tsx
- apps/web/src/features/dashboard/DashboardClient.test.tsx
- apps/api/src/routes/v1/stream.ts
- apps/api/src/routes/v1/stream.test.ts
- apps/api/src/routes/v1/dashboard.ts
- apps/api/src/routes/v1/dashboard.test.ts
- apps/api/src/server.ts
- _bmad-output/implementation-artifacts/3-2-real-time-compliance-dashboard-d1d2-shell.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-05-05: Implemented Story 3.2 dashboard read-model + UI shell + SSE updates + panel interactions; added tests and validations.

