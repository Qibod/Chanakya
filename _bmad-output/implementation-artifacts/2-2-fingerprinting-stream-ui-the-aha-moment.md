# Story 2.2: Fingerprinting Stream UI — The Aha Moment

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As a new user on the onboarding screen,
I want to watch the AI build my compliance framework live with confidence indicators,
so that I understand what has been inferred before committing it to my account.

## Acceptance Criteria

1. **Given** a user navigates to `/onboarding/fingerprint` after signup  
   **When** the page loads  
   **Then** a single autofocused input field is shown with placeholder **"Type your company name…"** and no other primary chrome  
   **And** no loading spinner or progress bar is shown before the user submits  

2. **Given** the user submits their company name and fingerprinting starts  
   **When** the job completes and results are available  
   **Then** each rendered line fades in with **`opacity: 0→1`** and **`translateY(4px→0)`** at **40ms stagger** intervals (unless reduced motion — see AC 7)  
   **And** each line displays: **`[phase chip] [content] [ConfidenceChip] [source chip(s)] [Override link]`**  
   **And** a **four-phase progress arc** (top-right) advances through: **Industry → Obligations → Controls → Integrations** as corresponding lines appear  

3. **Given** the user hovers over a confidence indicator for the first time in the session  
   **When** the hover fires  
   **Then** a **one-time** tooltip appears: **"AI confidence — click to see sources"**  
   **And** clicking the chip opens a **Popover** listing source citations for that line (`FingerprintSlice.sources`)  

4. **Given** the user clicks **Override** on any streamed line  
   **When** inline edit activates  
   **Then** an **`Input`** replaces that line’s content — **no modal, no navigation**  
   **And** the rest of the stream UI stays usable (user can continue reading; completion CTA rules below still apply)  
   **And** **Enter** saves the override and that line shows an **"Edited"** badge  

5. **Given** the stream completes all four phases  
   **When** the last line for phase 4 has appeared  
   **Then** a full-width primary button **"Looks right — let's continue"** appears below the stream  
   **And** a secondary control **"Edit anything before proceeding"** is available (inline expanded edit mode per UX spec — see Tasks)  

6. **Given** fingerprinting fails (`fingerprint.failed` SSE or `GET /v1/fingerprint/:jobId` shows failure)  
   **When** the user sees the error state  
   **Then** the UI explains the failure and offers **fallback to manual setup** (copy and navigation target consistent with UX — wire to placeholder route or existing settings if manual wizard not built yet; **do not** leave a dead end)  

7. **Given** the user has **`prefers-reduced-motion: reduce`**  
   **When** results display  
   **Then** all lines render **immediately** with **no** stagger or line entrance animation  

8. **Accessibility**  
   **And** the streaming region uses **`aria-live="polite"`** for incremental announcements where appropriate (UX-DR5 / `ux-design-specification.md`)  

## Tasks / Subtasks

- [x] **Task 1 — Route & layout** (AC: #1)  
  - [x] Add `apps/web/src/app/(onboarding)/onboarding/fingerprint/page.tsx` (or equivalent under app router) so the URL is **`/onboarding/fingerprint`**, post-signup entry (align with `_bmad-output/planning-artifacts/architecture.md` `(onboarding)/` tree).  
  - [x] Minimal layout: single field, autofocus, placeholder **exactly** as AC; no spinner before submit.

- [x] **Task 2 — Call API & obtain `jobId`** (AC: #2, #6)  
  - [x] On submit, `POST` to BFF **`/api/v1/fingerprint`** with `{ "companyName": "..." }` (camelCase per `@grc/types` `postFingerprintBodySchema`).  
  - [x] Handle **`202`** and read `{ data: { jobId } }` per API envelope.  
  - [x] On non-202, surface structured error from `{ error: { code, message } }`.

- [x] **Task 3 — Subscribe to SSE (architecture-compliant)** (AC: #2, #6)  
  - [x] **Critical:** `apps/web/src/app/api/v1/[...path]/route.ts` currently **`await upstream.json()`** for all GETs — **this breaks `text/event-stream`**. Either:  
    - [x] Add a **dedicated** Next.js Route Handler that proxies SSE (pipe `upstream.body` to client with `Content-Type: text/event-stream`, `Cache-Control: no-cache`, no JSON parsing), **or**  
    - [x] Branch the catch-all: if upstream `Content-Type` is event-stream, stream through without `json()`.  
  - [x] Browser **`EventSource`** cannot send `Authorization` headers; rely on **same-origin** `/api/...` + Clerk session cookie **or** document/implement a cookie-safe pattern consistent with `auth()` in the BFF (same pattern must work for `GET` stream).  
  - [x] Connect to **`GET /v1/stream/jobs/:jobId`** (implemented in `apps/api/src/routes/v1/stream.ts`) via the working BFF path.  
  - [x] Parse SSE `event` + `data` JSON; validate against **`fingerprintJobEventSchema`** (`@grc/types`) on the client for `fingerprint.completed` / `fingerprint.failed`.

- [x] **Task 4 — Map payload → lines + phases** (AC: #2, #5)  
  - [x] On **`fingerprint.completed`**, read `data.payload.summary` (**`FingerprintInferencePayload`**). Worker publishes **one** completion event with the full summary (`apps/worker/src/jobs/fingerprint.job.ts`) — there are **no** incremental per-line SSE messages today. Implement **client-side sequencing**: flatten slices into ordered **lines** with **phase metadata**, then animate reveal with **40ms stagger**.  
  - [x] **Phase / content mapping (normative for this story):**

| Phase | Arc label | Lines |
|------|-----------|-------|
| 1 | Industry | Single line from `industryClassification` (title + detail text) |
| 2 | Obligations | One line per entry in `regulatoryObligations` |
| 3 | Controls | Lines from `businessProcesses` then `riskDomains` (epic “controls” coverage) |
| 4 | Integrations | **No LLM field today** — render **one** concise synthetic line (e.g. suggested integrations / connect tooling next step) so the arc completes and AC #5 is satisfied; align copy with PM if needed |

  - [x] **Confidence UI:** `@grc/types` stores `confidence` **0..1**; `ConfidenceChip` (`packages/ui`) expects **0–100** — use **`Math.round(confidence * 100)`**. Tier thresholds: high ≥80%, medium 50–79%, low &lt;50% (match chip variant logic).  
  - [x] **Source chip:** display primary source(s) from `sources[]` (e.g. Badge); Popover lists full array.

- [x] **Task 5 — Components** (AC: #2–#4, #7–#8)  
  - [x] Implement **`StreamingText`** (feature module or `packages/ui` — prefer **feature folder** `apps/web/src/features/fingerprinting/` composing **`packages/ui`** primitives per architecture).  
  - [x] **Phase progress arc** (SVG stroke-dashoffset or equivalent): four segments mapped to phase index; advance as each phase’s **first** line starts animating.  
  - [x] **Override:** inline `Input` (shadcn from `packages/ui`), local React state; **Enter** commits → **"Edited"** badge. Persist overrides in client state for **Story 2.3** confirm payload (API contract in 2.3 — do not persist to server in 2.2).  
  - [x] **`prefers-reduced-motion`:** skip stagger; show all lines immediately.  
  - [x] **`aria-live="polite"`** wrapper around the streaming list region.

- [x] **Task 6 — Completion & secondary CTA** (AC: #5)  
  - [x] After phase 4 lines render, show primary **"Looks right — let's continue"** (disabled until stream complete + optional validation).  
  - [x] **"Edit anything before proceeding"** toggles expanded inline edit for **all** lines (still no modal).  
  - [x] **Do not** call `POST /v1/fingerprint/:jobId/confirm` here — that is **Story 2.3**; button may `router.push` to next onboarding step stub or stay on page until 2.3 wires confirm.

- [x] **Task 7 — Failure path** (AC: #6)  
  - [x] Handle `fingerprint.failed` + optional **`GET /v1/fingerprint/:jobId`** polling if SSE disconnects (polling already exists server-side from Story 2.1).  
  - [x] User-facing message + link to **manual setup** fallback.

- [x] **Task 8 — Tests**  
  - [x] Component tests: reduced motion, stagger timing (mock timers), override saves badge.  
  - [x] Integration test (Playwright/vitest + MSW): mock `POST` 202, SSE message with sample `FingerprintInferencePayload`, assert line order and CTA.

## Dev Notes

### Relationship to Story 2.1 (backend)

- **Contracts:** `POST /v1/fingerprint`, `GET /v1/fingerprint/:jobId`, `GET /v1/stream/jobs/:jobId` are implemented under `apps/api/src/routes/v1/`. Redis channel: `tenant:{tenantId}:job:{jobId}`.  
- **Completion payload:** `fingerprint.completed` includes `payload.summary` as full **`FingerprintInferencePayload`** (`packages/types/src/fingerprint.ts`).  
- **RBAC:** Routes use `requireTier("starter")` + `requireRole("ControlOwner")` (`apps/api/src/routes/v1/fingerprint.ts`, `stream.ts`). **`ROLE_SATISFIES`** allows **OrgAdmin** (and others) to satisfy **ControlOwner** for this check — verify default org role for new users during QA; **Developer** role does **not** satisfy **ControlOwner** — document if dev test users need OrgAdmin.  
- **Review debt from 2.1:** Story 2.1 file lists open patches (SSE sanitization, idempotency, etc.). UI work should **not** duplicate those fixes unless touching the same files; coordinate if stream behavior changes.

### BFF / SSE (must read before implementing)

```54:55:apps/web/src/app/api/v1/[...path]/route.ts
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
```

This **must not** run for SSE responses. Architecture (`architecture.md`) says browser → BFF → Fastify — streaming proxy must preserve **`text/event-stream`**.

### UX compliance

- **UX-DR5 / UX-DR18:** `_bmad-output/planning-artifacts/ux-design-specification.md` — StreamingText, ConfidenceChip, fingerprint journey (Priya), no spinner before stream, inline override.  
- **Epic UX lines:** `_bmad-output/planning-artifacts/epics.md` — Story 2.2 acceptance criteria are authoritative for copy and interaction.

### Project Structure Notes

- Follow monorepo layout: **`apps/web`** for routes/hooks; **`packages/ui`** for shared visuals; **`@grc/types`** for Zod types and enums.  
- Tailwind v4 + shadcn patterns already in `packages/ui`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.2]  
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Fingerprinting Stream, StreamingText, ConfidenceChip, Journey 1]  
- [Source: `_bmad-output/planning-artifacts/architecture.md` — BFF, SSE, frontend stack, folder hints]  
- [Source: `packages/types/src/fingerprint.ts` — payloads and job events]  
- [Source: `apps/api/src/routes/v1/stream.ts` — SSE route]  
- [Source: `apps/worker/src/jobs/fingerprint.job.ts` — published events]

## Technical Requirements Summary

- **Next.js 15** app router; **Clerk** auth; **TanStack Query** optional for `POST` / polling (SSE drives primary happy path).  
- **Zod** types from `@grc/types` — no duplicate schemas in `apps/web`.  
- **Accessibility:** focus management on single field; `aria-live` for stream; Radix Popover/Tooltip for confidence/sources.

## Architecture Compliance Checklist

- [x] Browser uses **BFF** for API/SSE — **no** raw Cloud Run URL in production client config  
- [x] SSE event envelope matches Redis → Fastify bridge (`event` + JSON `data`)  
- [x] Tenant/job ownership: only subscribe with `jobId` returned from **`POST`** for this session  
- [x] Styling uses **design tokens** / Tailwind from `packages/ui` conventions

## Library / Framework Requirements

| Area | Choice |
|------|--------|
| UI | shadcn/Radix via `packages/ui`, Tailwind v4 |
| Types | `@grc/types` |
| SSE client | Native `EventSource` after BFF supports streaming |
| Animation | CSS transitions; `matchMedia('(prefers-reduced-motion: reduce)')` |

## File Structure Requirements

| Path | Action |
|------|--------|
| `apps/web/src/app/(onboarding)/onboarding/fingerprint/page.tsx` | **NEW** — page shell |
| `apps/web/src/features/fingerprinting/` | **NEW** — StreamingText, hooks `useFingerprintStream`, phase arc |
| `apps/web/src/app/api/v1/[...path]/route.ts` | **UPDATE** — SSE-safe proxy **or** add parallel stream route |
| `packages/ui/src/components/ConfidenceChip.tsx` | **UPDATE** (optional) — Popover/tooltip wiring if not wrapping from feature |

## Testing Requirements

- Mock SSE in unit tests; do not require live Redis/API in CI.  
- Cover **reduced motion**, **override** behaviour, and **failure** event handling.

## Previous Story Intelligence (2.1)

- Story file: `_bmad-output/implementation-artifacts/2-1-ai-fingerprinting-pipeline-backend-job-claude-integration.md` — lists implemented paths, env vars, completion notes, and **review findings** (RBAC, SSE, worker edge cases).  
- **Implementation insight:** One **`fingerprint.completed`** event carries **`summary`** — UI should **simulate** progressive reveal; do not wait for multiple SSE chunks.  
- **Polling fallback:** `GET /v1/fingerprint/:jobId` exists for status + stored row when SSE fails.

## Git Intelligence Summary

Repository history on `main` shows Stories **1.1–1.6** merge commits; fingerprint API/worker code may exist on your branch from ongoing 2.1 work. Follow existing **`feat: Story X.Y — …`** commit convention.

## Latest Technical Information

- **Next.js Route Handlers:** use Web Streams / `ReadableStream` to proxy SSE without buffering the full body.  
- **Clerk + EventSource:** prefer same-origin BFF so session cookies participate in `auth()` on the server.

## Project Context Reference

- No `project-context.md` was found in the repo glob at workflow time; rely on this story + `architecture.md` + `epics.md`.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- None

### Completion Notes List

- Implemented `/onboarding/fingerprint` with `FingerprintOnboardingClient`: POST BFF, `EventSource` to `/api/v1/stream/jobs/:jobId`, `fingerprintJobEventSchema` validation, client-side line stagger (40ms), `prefers-reduced-motion` fast path, phase arc, confidence tooltip + sources popover, inline override + bulk edit, failure + polling fallback, manual-setup stub.
- BFF: stream `text/event-stream` body passthrough; `Content-Type: application/json` only for mutating methods; `GET` no JSON body implied.
- Tests: `build-fingerprint-lines`, Zod job-event envelope, vitest + Testing Library integration test with mocked `fetch` + `EventSource`.
- `pnpm test`, `pnpm --filter @grc/web build`, and `eslint` pass.

#### Code review follow-up (2026-05-05, `_bmad-output/implementation-artifacts/2-2-review-2026-05-05.md`)

**Critical**

- **SSE `onerror` vs completion race:** Introduced `jobOutcomeRef` (`pending` → `success` | `failed`). `handleInferencePayload` only runs while `pending`; success/failure set terminal state. `es.onerror` starts polling **only** if still `pending`, so a late error after `fingerprint.completed` does not re-poll or replay stagger.
- **Stale poll / EventSource across submits:** `submit()` begins with `esRef.current?.close()`, `stopPoll()`, reset outcome refs and `activeJobIdRef`; `activeJobIdRef` set after `202`. Try-again actions reset outcome refs.
- **Tests:** Added coverage for `fingerprint.failed` SSE, reduced-motion (`matchMedia`), override → **Edited**, sources popover **Escape** + outside-click dismissal, `fingerprint-constants.test.ts` for 40ms stagger; expanded integration suite.

**Suggestions addressed**

- **BFF:** Upstream `fetch` passes `signal: request.signal`. Non-JSON upstream responses wrapped in `try/catch` → 502 `UPSTREAM_INVALID_RESPONSE`.
- **Polling:** Max attempts (`POLL_MAX_ATTEMPTS` × 2s) with `failed_job` + `POLL_TIMEOUT`; polling respects `jobOutcomeRef` and `activeJobIdRef`.
- **Tooltip:** Session “first tip” tied to first qualifying hover (`sessionStorage`), not only `mouseLeave`.
- **Popover:** **Escape** and **mousedown** outside container ref (no Radix dependency in this pass).
- **Bulk edit / Edited:** Clearing text back to default removes override entry; exiting bulk edit diffs vs default; `saveOverride` clears **Edited** when saved text equals default.
- **`PhaseProgressArc`:** Outer `role="group"` + `aria-label`; decorative `<svg aria-hidden>`; stroke colours use `text-accent` / `text-foreground-muted`.

**Deferred / out of scope for this story**

- Radix Popover/Tooltip packages not added (custom behaviour sufficient for ACs; upgrade path noted in review).
- API `stream.ts` SSE event-name sanitization remains Story **2.1** backend debt.

### File List

- `apps/web/package.json`
- `apps/web/vitest.config.ts`
- `apps/web/src/test-setup.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/api/v1/[...path]/route.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/app/(onboarding)/onboarding/fingerprint/page.tsx`
- `apps/web/src/app/(onboarding)/onboarding/manual-setup/page.tsx`
- `apps/web/src/features/fingerprinting/index.ts`
- `apps/web/src/features/fingerprinting/build-fingerprint-lines.ts`
- `apps/web/src/features/fingerprinting/build-fingerprint-lines.test.ts`
- `apps/web/src/features/fingerprinting/parse-fingerprint-job-event.test.ts`
- `apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx`
- `apps/web/src/features/fingerprinting/FingerprintOnboardingClient.integration.test.tsx`
- `apps/web/src/features/fingerprinting/PhaseProgressArc.tsx`
- `apps/web/src/features/fingerprinting/fingerprint-constants.ts`
- `apps/web/src/features/fingerprinting/fingerprint-constants.test.ts`
- `pnpm-lock.yaml`

## Change Log

- **2026-05-05:** Story 2.2 implemented — fingerprint onboarding UI, SSE-safe BFF proxy, vitest + RTL integration coverage.
- **2026-05-05:** Code review follow-up — job lifecycle refs (`jobOutcomeRef`, `activeJobIdRef`), submit/SSE/poll teardown, capped polling + timeout, BFF `AbortSignal` + safe JSON parse, a11y/token tweaks on phase arc, tooltip/popover/edit behaviour, expanded tests (see Completion Notes → “Code review follow-up”).

---

## Open Questions / Clarifications

_(Non-blocking — resolve with PM/UX as needed)_

1. Exact **copy** for synthetic **Integrations** phase line and **manual setup** fallback route.  
2. Confirm default **Clerk org role** for first user vs `requireRole("ControlOwner")` API gate in integration environments.  
3. Whether **Story 2.3** confirm API will accept **inline override** payload shape — design client state structure accordingly.
