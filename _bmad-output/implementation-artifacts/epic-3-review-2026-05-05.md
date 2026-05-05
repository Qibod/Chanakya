# Epic 3 Code Review — 2026-05-05

**Stories reviewed:** 3.1, 3.2, 3.3, 3.4, 3.5  
**Reviewer:** Antigravity (Claude Sonnet 4.6 Thinking)  
**Method:** Blind Hunter + Edge Case Hunter + Acceptance Auditor (parallel adversarial layers)

---

## Summary

| Story | Patches | Defers | Critical Issues |
|-------|---------|--------|-----------------|
| 3.1 Control Library List View | 4 | 2 | SSE 403 flood for ControlOwner role |
| 3.2 Compliance Dashboard D1+D2 | 5 | 3 | RBAC bug: AuditDirector locked out of dashboard |
| 3.3 Control Assignment + AI Instructions | 4 | 2 | Concurrent assignment race, fallback duplication |
| 3.4 Control Owner D4 My Tasks | 4 | 3 | Missing tier guard, misleading redaction comment |
| 3.5 Gap Remediation & Framework Progress | 6 | 3 | Framework meta crash, fabricated timestamps, missing SSE |
| **TOTAL** | **23** | **13** | |

---

## Story 3.1 — Control Library List View, Status & Domain Organisation

**Files:** `apps/api/src/routes/v1/frameworks.ts` · `apps/web/src/features/controls/ControlLibraryClient.tsx`

### Patch Findings

| ID | Severity | Finding |
|----|----------|---------|
| F1 | HIGH | **SSE 403 flood for ControlOwner** — `ControlLibraryClient` unconditionally opens `EventSource('/api/v1/stream/control-health')` but that stream is gated at `AuditDirector`. A `ControlOwner` on `/controls` triggers repeated failed reconnects. Fix: conditionally open SSE only when the current user role is `AuditDirector`. |
| F2 | MEDIUM | **`formatLastUpdated` negative diffMs** — if `updated_at` is in the future (server clock skew), labels like `"-1m ago"` appear. Fix: add `if (diffMs < 0) return { label: 'just now' }` guard. |
| F3 | MEDIUM | **Owner filter silently caps at 10** — tenants with >10 distinct control owners cannot filter by the 11th+. No overflow indicator. Fix: add "Show more" toggle or owner search input when `owners.length > 10`. |
| F4 | LOW | **`initialsForOwner` is misnamed** — returns tail 2 alphanumeric chars of a user ID, not name initials. Rename to `displayCharsForOwner`; document that owner names aren't yet available from API. |

### Deferred

| ID | Finding |
|----|---------|
| D1 | `frameworkProgress` block ignores active status/owner filters — pre-existing data shape limitation. |
| D2 | "Clear all" button lacks explicit `aria-label="Clear all filters"` — text content is technically accessible. |

---

## Story 3.2 — Real-Time Compliance Dashboard D1+D2 Shell

**Files:** `apps/api/src/routes/v1/dashboard.ts` · `apps/web/src/features/dashboard/DashboardClient.tsx` · `apps/api/src/routes/v1/stream.ts`

### Patch Findings

| ID | Severity | Finding |
|----|----------|---------|
| G1 | CRITICAL | **RBAC gate is `OrgAdmin` — AuditDirector locked out** — `dashboardPreHandlers` uses `requireRole("OrgAdmin")` instead of `requireRole("AuditDirector")`. The primary dashboard persona (AuditDirector) cannot access `GET /v1/dashboard`. Fix: change to `requireRole("AuditDirector")`. [`dashboard.ts:7`] |
| G2 | HIGH | **"Assign" button has no onClick handler** — both `ControlDomainCard` and `FeedItem` render an "Assign" button with no handler. AC4 requires it to be actionable. Fix: wire to assignment modal or placeholder until Story 3.3 integration. |
| G3 | MEDIUM | **FeedItem fail items are never collapsible** — `expanded = open \|\| item.severity === "fail"` means failing items cannot be toggled closed, and `aria-expanded` is permanently `true`. Fix: remove `\|\| item.severity === "fail"` from `expanded`; keep the initial `useState` default. |
| G4 | MEDIUM | **Duplicate SidePanel implementation** — `DashboardClient` re-implements 80+ lines of side panel logic instead of reusing `ControlSidePanel` from Story 3.1 as specified. Refactor to import `ControlSidePanel`. |
| G5 | MEDIUM | **Redis cache hit has no schema validation** — `JSON.parse(cached) as unknown` is returned directly. A stale schema after a deploy will silently serve malformed data. Fix: add Zod validation and fall through to live query on failure. |

### Deferred

| ID | Finding |
|----|---------|
| D3 | `sparkline30d` is a flat constant (passRatePct × 30) — not real 30-day history. Requires server-side time-series model; deferred to future story. |
| D4 | Dashboard source query fetches all control rows without LIMIT — optimise with split queries. |
| D5 | `closePanel` setTimeout(220ms) race on rapid re-open — pre-existing interaction edge-case. |

---

## Story 3.3 — Control Assignment & AI-Generated Task Instructions

**Files:** `apps/api/src/routes/v1/frameworks.ts` (POST assign, GET controls/:id) · `packages/ai/src/task-instructions.ts`

### Patch Findings

| ID | Severity | Finding |
|----|----------|---------|
| H1 | HIGH | **Concurrent assignment race → unhandled 500** — Two simultaneous `POST /v1/controls/:id/assign` calls can both insert `is_current=TRUE` rows; the unique partial index violation surfaces as an unhandled 500. Fix: catch `isPostgresUniqueViolation` in the transaction block and return 409. [`frameworks.ts:702-743`] |
| H2 | MEDIUM | **`new VertexAIProvider()` per-request** — A new gRPC channel is created per assignment. Hoist to module level (consistent with `my-tasks.ts` pattern). [`frameworks.ts:681`] |
| H3 | MEDIUM | **`fallbackInstruction` duplicated** — Identical function exists in both `packages/ai/src/task-instructions.ts` and `apps/api/src/routes/v1/frameworks.ts`. Remove the copy in `frameworks.ts`; export and import from `@grc/ai`. |
| H4 | MEDIUM | **Assignment response `id` is the control ID, not assignment ID** — Callers cannot reference the specific assignment record. Fix: use `RETURNING id` on the INSERT and return as `assignmentId` alongside `controlId`. [`frameworks.ts:745-755`] |

### Deferred

| ID | Finding |
|----|---------|
| D6 | `instructionModel` hardcoded as `"claude-sonnet-4-6"` with `VertexAIProvider` — document if Claude-via-Vertex is intentional. |
| D7 | `GET /v1/controls/:id` triggers AI regeneration for ControlOwner role — unexpected write side-effect on a read endpoint. |

---

## Story 3.4 — Control Owner D4 Clarity First View (`/my-tasks`)

**Files:** `apps/api/src/routes/v1/my-tasks.ts` · `apps/web/src/features/tasks/MyTasksClient.tsx` · `packages/ui/src/components/ActionSpotlight.tsx`

### Patch Findings

| ID | Severity | Finding |
|----|----------|---------|
| I1 | HIGH | **Missing `requireTier` on all three my-tasks endpoints** — Inline role check skips tier validation. Free/trial-tier tenants can access these endpoints. Fix: add `requireTier("starter")` to each preHandler array. [`my-tasks.ts:30,119,195`] |
| I2 | HIGH | **Compliance code "redaction" logs but does not redact** — `request.log.warn(...)` fires but payload is returned unchanged. The comment says "redacting" — misleading. Fix: implement actual server-side stripping or remove the comment and document that `ActionSpotlight.stripComplianceCodes` is the sole enforcement. [`my-tasks.ts:106-110`] |
| I3 | MEDIUM | **Re-completion leaves stale `evidence_item_id`** — `ON CONFLICT (assignment_id) DO UPDATE SET completed_at = NOW()` does not update `evidence_item_id`. A second completion creates a new blob but the completion record still points to the old one. Fix: also update `evidence_item_id = EXCLUDED.evidence_item_id, completed_by = EXCLUDED.completed_by`. [`my-tasks.ts:270-273`] |
| I4 | MEDIUM | **No optimistic UI for task completion** — Card stays in `"todo"` variant until `q.refetch()` resolves. Spec says card should "transition to a `complete` variant" as part of the action. Fix: add `qc.setQueryData(["my-tasks"], (old) => ...)` optimistic update in `completeMutation.onSuccess`. [`MyTasksClient.tsx:72-79`] |

### Deferred

| ID | Finding |
|----|---------|
| D8 | `POST /v1/my-tasks/:controlId/why-needed` has no caching — add Redis cache keyed on `userId:controlId` TTL ~1h. |
| D9 | `completeMutation.onSuccess` uses `q.refetch()` — replace with `qc.invalidateQueries()` for stale-while-revalidate. |
| D10 | Disabled "Start review →" button has no aria explanation — add `aria-describedby` referencing the task-complete status. |

---

---

## Story 3.5 — Gap Remediation Tracking & Framework Completion Progress

**Files:** `apps/api/src/routes/v1/gaps.ts` · `apps/web/src/features/gaps/GapsClient.tsx` · `apps/web/src/features/controls/ControlSidePanel.tsx` · `apps/web/src/lib/control-status.ts`

### Patch Findings

| ID | Severity | Finding |
|----|-----------|---------|
| J1 | HIGH | **`FRAMEWORK_LIBRARY_META[id].title` crashes on unknown IDs** — If `framework_refs` contains a future or corrupted framework ID, the property access throws a TypeError, crashing the request handler. Fix: `FRAMEWORK_LIBRARY_META[id as FrameworkId]?.title ?? id`. [`gaps.ts:67`] |
| J2 | HIGH | **`updatedAt` fallback fabricates `new Date()` for null timestamps** — Controls with a null `updated_at` appear as last-updated "now" in the table and CSV. Fix: return `null`; update `GapItem` type to `updatedAt: string | null`; display `"—"` in the UI. [`gaps.ts:72-76`] |
| J3 | HIGH | **`GapsClient` has no SSE subscription** — Remediating a control while `/gaps` is open does not update the list in real time. Task 3 spec explicitly requires this. Fix: subscribe to `/api/v1/stream/control-health` and `invalidateQueries(["gaps-list"])` on events. [`GapsClient.tsx`] |
| J4 | MEDIUM | **`FrameworkBadge` receives `f.key as never`** — Type suppression masks a real `string` vs `FrameworkId` mismatch. Fix: type `GapItem.frameworks[].key` as `FrameworkId` throughout. [`GapsClient.tsx:145`] |
| J5 | MEDIUM | **"Assign" button shown even when control is already assigned** — AC3 says show only when no owner. Currently both "Assign" button and "Assigned to: X" appear simultaneously. Fix: `{showAssign && !detailQ.data?.assignment?.assignedTo ? <button>Assign</button> : null}`. [`ControlSidePanel.tsx:248-259`] |
| J6 | MEDIUM | **`/gaps` page has no role gate** — ControlOwner navigating to `/gaps` sees the page with an API 403 error but no redirect. Fix: add AuditDirector role check with redirect, consistent with `/my-tasks`. [`gaps/page.tsx`] |

### Deferred

| ID | Finding |
|----|---------|
| D11 | `GET /v1/gaps` returns all items without pagination — acceptable at MVP; add cursor pagination for scale. |
| D12 | `csvEscape` does not handle `\r` (carriage return) — RFC 4180 compliance gap. |
| D13 | `exportCsv` DOM `<a>` not cleaned up on error — `URL.revokeObjectURL` not called if `a.click()` throws. |

---

## Cross-Story Patterns Worth Tracking

1. **SSE RBAC mismatch** — Both 3.1 (`ControlLibraryClient`) and 3.5 (`GapsClient`) illustrate the same failure mode: SSE subscription lifecycle not gated by role. Establish a `useControlHealthSSE(enabled: boolean)` hook that centralises the subscription and can be feature-flagged by role.
2. **VertexAIProvider lifecycle** — Module-level provider instantiation is used correctly in `my-tasks.ts` but not in `frameworks.ts`. Add an architecture note or a shared singleton export from `packages/ai`.
3. **Redis cache validation** — Cached JSON is trusted without schema validation in the dashboard. Establish a pattern (Zod parse + fallthrough) for any Redis cache hit path.
4. **Compliance code safety** — Server-side detection without actual server-side enforcement creates a false security layer. Decide ownership: either strip at API boundary or enforce only at component boundary (document this explicitly).
5. **Type suppression (`as never`, `as FrameworkId`)** — Story 3.5 uses `as never` to silence a `FrameworkBadge` prop type error. Any `as never` / `as unknown` cast touching user data should be treated as a type-safety red flag and fixed at the type definition level.
