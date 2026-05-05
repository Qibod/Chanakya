# Story 3.4: Control Owner D4 Clarity First View (`/my-tasks`)

Status: in-progress

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As a **Control Owner**,
I want a simple, jargon-free task view showing only my assigned controls,
so that I can complete my compliance responsibilities without navigating the full platform or asking for help.

## Acceptance Criteria

1. **Given** a Control Owner logs in and is routed to `/my-tasks`  
   **When** the page renders  
   **Then** a hero section shows: "You have [N] task to complete" and "2 controls are automated — nothing needed from you"  
   **And** one `ActionSpotlight` card is shown per assigned task with a plain-English title, plain-English description, and a "Start review →" primary CTA  
   **And** **no compliance codes** (e.g. "CC6.1", "ISO A.9.2") appear anywhere on this view

2. **Given** a Control Owner clicks "Why is this needed?" on an `ActionSpotlight` card  
   **When** the inline expander opens  
   **Then** an AI-generated plain-English explanation appears **without navigation away** from the page  
   **And** the explanation does **not** contain audit jargon; it explains the business reason in 2–3 sentences

3. **Given** a Control Owner completes a task (evidence uploaded and confirmed)  
   **When** the submission is processed  
   **Then** the `ActionSpotlight` card transitions to a `complete` variant with a checkmark bloom animation (300ms)  
   **And** the hero count decrements: "You have [N-1] tasks to complete"  
   **And** if all tasks are complete, the hero reads "You're all clear. No tasks assigned to you right now." with no further CTAs

4. **Given** a Control Owner has no assigned tasks  
   **When** `/my-tasks` loads  
   **Then** the page shows: "You're all clear. No tasks assigned to you right now." — a positive empty state, not an error

5. **Given** `/my-tasks` is accessed by an Audit Director role  
   **When** the routing logic runs  
   **Then** they are redirected to `/dashboard` — the D4 view is exclusively for the `ControlOwner` role

## Tasks / Subtasks

### Task 1 — Lock down routing + role exclusivity (AC: #1, #5)

- [ ] **Update** `apps/web/src/app/(app)/my-tasks/page.tsx` from placeholder to real page and enforce role gating:
  - If current user role is not `ControlOwner`, redirect to `/dashboard`.
  - Must handle both:
    - role-based landing via `apps/web/src/app/page.tsx` (already routes `ControlOwner` → `/my-tasks`)
    - direct navigation to `/my-tasks`
- [ ] Preserve current auth behavior:
  - `apps/web/src/middleware.ts` already protects `/my-tasks(.*)` with Clerk — do not bypass it.

### Task 2 — API read model for “my tasks” (AC: #1, #4)

Implement a dedicated read model endpoint rather than reusing the generic controls list (keeps the D4 page token-light and avoids accidental compliance-code leakage).

- [ ] **Add** `GET /v1/my-tasks` in `apps/api` (new route file preferred, e.g. `apps/api/src/routes/v1/my-tasks.ts`, or add to `frameworks.ts` if that’s the established pattern).
- [ ] RBAC:
  - Must require auth + tenant middleware.
  - Must require `ControlOwner` role (AuditDirector/OrgAdmin must not be able to call this endpoint for themselves as “tasks” UX).
- [ ] Response envelope: `{ data: { summary, tasks } }` (follow architecture API envelope).
- [ ] `summary` fields (minimum):
  - `taskCount: number` (tasks that require action)
  - `automatedCount: number` (tasks that are “automated — nothing needed”)
- [ ] `tasks[]` shape (minimum, no compliance codes):
  - `controlId: string`
  - `title: string` (plain English; must not contain framework codes)
  - `description: string` (plain English; 1–2 sentences)
  - `dueDate: string | null` (ISO date `YYYY-MM-DD` if known)
  - `status: "todo" | "complete"` (D4 view only; not the platform-wide control status)
  - `whyNeeded?: { text: string | null; generatedAt: string | null }` (optional; can be null until user expands)
- [ ] Data sources & definition (MVP, aligns with Story 3.3 data model):
  - “Assigned task” = current row in `control_assignments` where `assigned_to = request.user.userId` AND `is_current = true`.
  - “Task requires action” = assignment exists AND (control is not `pass` AND not `auto`) OR assignment is newer than last evidence (if evidence model supports this).
  - “Automated controls” count (for the hero copy) = number of assigned controls whose `control_items.status = 'auto'` OR `pass` **and** have a current assignment.  
    - Note: the AC wording shows `"2 controls are automated — nothing needed from you"`; implement using actual counts, but keep the copy format identical.
- [ ] **Hard rule**: never return `framework_refs`, requirement codes, or any strings containing patterns like `SOC2:` / `ISO` codes to the D4 client.

### Task 3 — “Why is this needed?” generation (AC: #2)

We already have `@grc/ai` infrastructure and a “task instructions” prompt from Story 3.3. For Story 3.4 we need a shorter, plainer “why” explanation.

- [ ] **Add** a small prompt helper in `packages/ai` for `whyNeeded` text:
  - Inputs: `{ controlName, domain, connectedIntegrations }` plus any safe metadata (no evidence blobs).
  - Output: 2–3 plain-English sentences, no audit jargon, no compliance codes.
  - Model: `claude-sonnet-4-6` (sync) unless architecture says otherwise.
  - Add a safe fallback (static template) if generation fails or times out.
- [ ] API strategy options:
  - Option A (preferred): `POST /v1/my-tasks/:controlId/why-needed` returns `{ data: { text, generatedAt } }`
  - Option B: generate on-demand inside `GET /v1/my-tasks` only when a query param like `?includeWhy=true` is passed.
  - Choose Option A if you want to avoid repeated AI calls on initial page load.

### Task 4 — D4 UI: hero + ActionSpotlight cards (AC: #1, #4)

- [ ] **Update** `apps/web/src/app/(app)/my-tasks/page.tsx` to render:
  - Hero copy with counts:
    - `"You have ${N} task${N === 1 ? "" : "s"} to complete"`
    - `"${automatedCount} controls are automated — nothing needed from you"`
  - When `taskCount === 0`: show the positive empty state exactly as AC.
- [ ] Data fetching:
  - Use TanStack Query (consistent with `DashboardClient.tsx`, `ControlLibraryClient.tsx`).
  - Query key: `["my-tasks"]` (and subkeys for why-needed).
- [ ] Layout/visual constraints:
  - Must feel like the simplest view in the platform (D4 “Clarity First”).
  - No sidebar-heavy “power UI” density; the page should read like a shopping list.
  - Desktop-first; keep it responsive but don’t over-invest in mobile beyond existing breakpoints.

### Task 5 — Build `ActionSpotlight` component in `@grc/ui` (AC: #1–#3)

`ActionSpotlight` is called out explicitly in UX-DR11/UX-DR19 and in Epics. It does **not** exist in code today.

- [ ] **Add** `packages/ui/src/components/ActionSpotlight.tsx`
  - Variants: `urgent` (amber), `normal` (accent), `complete` (green)
  - Anatomy: icon, title, description, primary CTA area, inline expander link "Why is this needed?"
  - Must never render compliance codes; if input includes code-like strings, strip/redact them.
  - Must respect `prefers-reduced-motion`:
    - The “checkmark bloom” animation should be disabled (or reduced to instant state) under reduced motion.
- [ ] **Export** from `packages/ui/src/components/index.ts`
- [ ] **Add Storybook stories** for all variants and key states:
  - `normal` (collapsed)
  - `normal` (why-needed expanded)
  - `urgent`
  - `complete` (with animation vs reduced-motion)

### Task 6 — “Complete task” flow wiring (AC: #3)

This story requires “evidence uploaded and confirmed” before showing completion. Implement minimally but end-to-end:

- [ ] Decide the minimal “completion” event for MVP:
  - If evidence upload endpoints/UI already exist for a control, reuse them and then call a task completion endpoint.
  - If not, implement a minimal “attach evidence” flow inside `/my-tasks` that doesn’t expose codes:
    - a file upload control with clear accepted types and a success confirmation.
- [ ] **Add** a backend completion endpoint:
  - `POST /v1/my-tasks/:controlId/complete`
  - Validates the caller is the current assignee and that required evidence exists for the control (or accepts a minimal evidence reference created in the same flow).
  - Marks the task as complete for this view (either via an assignment field, or a small `control_owner_task_completions` table; avoid mutating `control_items.status` in a way that conflicts with `ControlStatus` typing).
- [ ] After completion, update the client state:
  - Optimistic UI update is fine, but must revert on error.

### Task 7 — Tests (API + Web) (AC: all)

- [ ] API tests:
  - `GET /v1/my-tasks`: 401 unauthenticated; 403 wrong role; 200 returns no compliance codes in payload; empty state behavior.
  - Why-needed endpoint: returns 2–3 sentences, fallback behavior works.
  - Complete endpoint: 403 if not assignee; 400 if missing evidence (depending on decision).
- [ ] Web tests:
  - `/my-tasks` renders hero + cards for assigned tasks
  - “Why is this needed?” expands inline without navigation
  - Completing a task transitions card to `complete` variant and decrements hero count
  - a11y smoke: no focus traps broken; buttons have accessible names; no compliance codes appear in rendered text

## Dev Notes

### What exists today (read before changing anything)

- `/my-tasks` currently exists but is a stub placeholder:
  - `apps/web/src/app/(app)/my-tasks/page.tsx` renders “Full implementation in Story 3.4”.
- Role-based routing exists on app root:
  - `apps/web/src/app/page.tsx` fetches `GET /api/v1/me` and redirects by role, including `ControlOwner → /my-tasks`.
- BFF proxy exists:
  - `apps/web/src/app/api/v1/[...path]/route.ts` proxies to `apps/api` `INTERNAL_API_URL`, attaching Clerk token.
- Sidebar has a ControlOwner-specific nav that already links to `/my-tasks`:
  - `apps/web/src/components/layout/Sidebar.tsx`
- Assignment model + AI instruction generation were implemented in Story 3.3:
  - Control assignments stored in tenant table `control_assignments`
  - Control detail already returns `assignment` data (in `ControlLibraryClient.tsx` UI)

### Architecture guardrails (must follow)

- **API envelope**: success `{ data: ... }`; errors `{ error: { code, message, details? } }`. (Note: `GET /v1/me` currently returns raw fields; do not copy this mistake into new endpoints.)
- **Tenant isolation**: always resolve tenant from `request.tenant`; never trust tenant IDs from client.
- **RBAC**: enforce role server-side for every endpoint; client-side checks are decorative only.
- **AI safety**: never pass evidence blob contents to the LLM; metadata only; keep outputs free of compliance jargon for ControlOwner UX.
- **Frontend data fetching**: TanStack Query; no `useEffect + fetch` loops for server state.

### “Don’t reinvent wheels” guidance (avoid common disasters)

- Reuse the existing BFF proxy (`/api/v1/*`) for all calls from `apps/web`.
- Reuse existing UI tokens/components (`StatusChip`, `FrameworkBadge`, `ConfidenceChip`) where appropriate, but **do not** expose compliance codes on `/my-tasks`.
- Don’t build a second “assignment” system; `/my-tasks` should be driven from `control_assignments` created in Story 3.3.

### References

- Story source: `_bmad-output/planning-artifacts/epics.md` → “Epic 3” → “Story 3.4”
- UX specs:
  - `_bmad-output/planning-artifacts/ux-design-specification.md` (D4 Clarity First view, UX-DR11, UX-DR19)
- Existing stub to replace: `apps/web/src/app/(app)/my-tasks/page.tsx`
- Existing role routing: `apps/web/src/app/page.tsx`
- Existing BFF proxy: `apps/web/src/app/api/v1/[...path]/route.ts`
- Existing assignment implementation context: `_bmad-output/implementation-artifacts/3-3-control-assignment-ai-generated-task-instructions.md`

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

### Completion Notes List

### File List

