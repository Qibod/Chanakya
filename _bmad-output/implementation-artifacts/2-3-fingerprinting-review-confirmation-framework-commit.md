# Story 2.3: Fingerprinting Review Confirmation & Framework Commit

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As a new user who has reviewed the AI-inferred data,
I want to confirm or edit the fingerprint results before they enter my control framework,
so that no AI-inferred data is committed to the system without my explicit approval.

## Acceptance Criteria

1. **Given** the user clicks **"Looks right — let's continue"** on the fingerprinting screen  
   **When** the confirmation is processed  
   **Then** `POST /v1/fingerprint/:jobId/confirm` is called and the `fingerprint_results` row’s `status` changes from **`pending_review`** to **`committed`**  
   **And** the confirmed inference (industry, obligations, processes, risk domains, org structure — see merge rules below) is persisted as the tenant’s authoritative fingerprint profile for downstream features  
   **And** the user is routed to the **integration setup** experience (see Routing)

2. **Given** the user clicks **"Edit anything before proceeding"**  
   **When** edit mode activates  
   **Then** all streamed lines become individually editable inline fields (extend existing bulk-edit behaviour from Story 2.2)  
   **And** the user can **remove** any line entirely via an **×** control (destructive at line level only — no modal; aligns with UX **inline-only** rule for onboarding)  
   **And** the primary CTA label changes to **"Confirm my edits — let's continue"** (both CTAs ultimately invoke the same confirm path with merged payload)

3. **Given** a user submits confirmation (either primary CTA variant)  
   **When** the commit succeeds  
   **Then** an append-only **`platform_audit_logs`** row is inserted with **`action`** = `fingerprint.confirmed`, **`resource_type`** = `fingerprint_job`, **`resource_id`** = `{jobId}`, **`actor_id`** = current Clerk user id, and **`tenant_id`** = active tenant  
   **And** the canonical confirmed payload remains queryable from **`fingerprint_results.data`** (JSONB) after commit — audit row references the job; full payload is not duplicated in `platform_audit_logs` (table has no payload column per [`packages/db/prisma/schema.prisma`](../../../packages/db/prisma/schema.prisma))

4. **Onboarding progression**  
   **And** onboarding advances past fingerprinting toward **integration setup** (persistent checklist is Story 2.5 — until then, routing + optional `sessionStorage`/cookie flag is acceptable if documented)

## Tasks / Subtasks

- [x] **Task 1 — Shared types (`@grc/types`)** (AC: #1–#3)  
  - [x] Add Zod schema **`postFingerprintConfirmBodySchema`** (e.g. `{ overrides?: Record<string, string>, removedLineIds?: string[] }` or equivalent) with bounds (max keys, max string lengths).  
  - [x] Add pure function **`applyFingerprintConfirmEdits(base: FingerprintInferencePayload, overrides, removedLineIds): FingerprintInferencePayload`** (or split client/server shared module) so API and web cannot drift.  
  - [x] Document **line id contract** — must match [`apps/web/src/features/fingerprinting/build-fingerprint-lines.ts`](../../../apps/web/src/features/fingerprinting/build-fingerprint-lines.ts): `industry`, `obligation-{i}`, `process-{i}`, `risk-{i}`, `integrations-synthetic`.  
  - [x] **Pass-through:** `inferredOrgStructure` is in [`fingerprintInferencePayloadSchema`](../../../packages/types/src/fingerprint.ts) but **not** shown as stream lines in 2.2 — it must be **copied through unchanged** on commit unless product adds UI later.

- [x] **Task 2 — API `POST /v1/fingerprint/:jobId/confirm`** (AC: #1, #3)  
  - [x] Implement in [`apps/api/src/routes/v1/fingerprint.ts`](../../../apps/api/src/routes/v1/fingerprint.ts) with same **`fingerprintPreHandlers`** as existing fingerprint routes (`requireTier("starter")` + `requireRole("ControlOwner")`).  
  - [x] Validate **`jobId`** ownership prefix `${tenantId}.fingerprint.` (same pattern as GET).  
  - [x] Load row from `"${schema}".fingerprint_results`; require **`status === 'pending_review'`**; return **409** if already `committed`, **400** if `failed`/`queued`.  
  - [x] Parse `data` JSON as **`FingerprintInferencePayload`**; run **`applyFingerprintConfirmEdits`**; re-validate with Zod.  
  - [x] **`UPDATE`** row: `status = 'committed'`, `data = merged json`, `confirmed_at = NOW()`, `updated_at = NOW()`, refresh `industry` / `confidence_scores` if needed for consistency with worker.  
  - [x] **`prisma.platformAuditLog.create`** — `action: "fingerprint.confirmed"`, `resourceType: "fingerprint_job"`, `resourceId: jobId`, `actorId: request.user.userId`, `tenantId`, optional `ipAddress` from `X-Forwarded-For` / socket.  
  - [x] Response: **`200`** with `{ data: { jobId, status: 'committed' } }` per API envelope conventions.

- [x] **Task 3 — BFF proxy** (AC: #1)  
  - [x] Ensure [`apps/web/src/app/api/v1/[...path]/route.ts`](../../../apps/web/src/app/api/v1/[...path]/route.ts) forwards **`POST`** with JSON body to API (already pattern for mutating calls — verify confirm path not blocked).

- [x] **Task 4 — Web client (`FingerprintOnboardingClient`)** (AC: #1, #2, #4)  
  - [x] Keep **`jobId`** in React state after successful fingerprint run (already available as `ui.kind === 'awaiting' | stream`** — ensure confirm can read `jobId` after stream completes).  
  - [x] Replace **placeholder** navigation [`router.push("/dashboard")`](../../../apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx) on primary CTA with: **`POST /api/v1/fingerprint/${jobId}/confirm`** with JSON body `{ overrides, removedLineIds }`, credentials **`same-origin`**, handle **`{ error: { code, message } }`**.  
  - [x] On success: **`router.push`** to integration setup route (see Routing).  
  - [x] **Loading / error:** disable CTA while submitting; toast or inline error on failure; do not clear fingerprint UI until success.  
  - [x] **Bulk edit:** implement **per-line remove** (`removedLineIds` state + × button per row when `bulkEdit` or dedicated remove mode per epic).  
  - [x] **CTA copy:** when `bulkEdit === true` OR any removal occurred, primary button reads **"Confirm my edits — let's continue"**.  
  - [x] Map **`overrides`** from existing state (`Record<lineId, edited text>`) — format **`title: detail`** must round-trip consistently with **`applyFingerprintConfirmEdits`** parsing.

- [x] **Task 5 — Integration setup destination** (AC: #1)  
  - [x] Add a real route for **integration setup** under onboarding **or** reuse app **`/integrations`** with a first-run empty state. **Recommendation:** add **`apps/web/src/app/(onboarding)/onboarding/integrations/page.tsx`** with minimal shell copy (“Connect your first integration”) + link to `/integrations` if the full catalog lives there — keeps onboarding URL namespace consistent with **`/onboarding/fingerprint`**. Register path in [`middleware.ts`](../../../apps/web/src/middleware.ts) if new segment needs protection (parent `(onboarding)` already covered).

- [x] **Task 6 — Tests** (AC: all)  
  - [x] Unit tests: **`applyFingerprintConfirmEdits`** — overrides, removals, ordering, synthetic integrations line, pass-through org structure.  
  - [x] API test: confirm happy path, wrong tenant jobId → 403, double confirm → 409.  
  - [x] Client test: mock **`fetch`** for confirm; assert redirect target and payload shape.

## Dev Notes

### Current implementation gaps (must fix in this story)

- **Confirm endpoint is missing** — only [`POST /v1/fingerprint`](../../../apps/api/src/routes/v1/fingerprint.ts) and [`GET /v1/fingerprint/:jobId`](../../../apps/api/src/routes/v1/fingerprint.ts) exist.  
- **Primary CTA incorrectly goes to `/dashboard`** — see [`FingerprintOnboardingClient.tsx`](../../../apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx) footer (~lines 505–513).  
- **Bulk edit** exists; **line removal ×** and **dynamic CTA label** are not implemented.  
- **`inferredOrgStructure`** must remain in committed payload even though it is not displayed in the 2.2 stream.

### Relationship to Story 2.2 (UI)

- Overrides are already held in client state for confirm (`overrides`, `edited`) — **Story 2.2** explicitly deferred server persistence to 2.3.  
- SSE and **`buildFingerprintLines`** ordering are normative for **line ids**.

### Relationship to Story 2.4 (framework library)

- Epic language “written to tenant’s framework configuration” for this story is satisfied by **`fingerprint_results` committed row** + downstream readers (2.4 activates frameworks and hydrates controls — may read committed fingerprint for **recommended** badges). Do **not** duplicate business logic into `framework_activations` until 2.4 unless PRD requires early seeding.

### UX compliance

- **UX spec:** Human review gate — [`ux-design-specification.md`](../../planning-artifacts/ux-design-specification.md) (**Human review gate**, **inline corrections**). No modal confirmations for non-destructive edits; line removal is inline.  
- **Trust:** Confirmed data only after explicit CTA — never silent commit.

### RBAC (consistent with 2.1 / 2.2)

- Same gates as fingerprint enqueue: **`requireTier("starter")`** + **`requireRole("ControlOwner")`**. OrgAdmin satisfies ControlOwner via **`ROLE_SATISFIES`** — **Developer** does not; use OrgAdmin test users in QA.

### Routing

- **Epics authoritative copy:** user lands on **integration setup screen** after commit. **Concrete path:** implement **`/onboarding/integrations`** (recommended) **or** **`/integrations`** — pick one and use it in **both** epic alignment and `router.push`.

## Technical Requirements Summary

| Area | Requirement |
|------|-------------|
| API | Fastify route, Zod validation, tenant schema raw SQL or Prisma tenant extension pattern consistent with existing fingerprint routes |
| Audit | `PlatformAuditLog` insert only; never UPDATE audit table |
| Types | Single source in `packages/types`; no duplicate inference shapes in `apps/web` |
| Web | BFF `/api/v1/...` only; same-origin cookies for auth |

## Architecture Compliance Checklist

- [x] Multi-tenant: **`jobId`** prefix guard; queries scoped to `request.tenant.schemaName`  
- [x] API envelope: success `{ data: ... }`, errors `{ error: { code, message } }`  
- [x] Append-only audit log matches ARCH-3  
- [x] No raw Cloud Run URL in browser

## Library / Framework Requirements

| Area | Choice |
|------|--------|
| Validation | Zod in `@grc/types` |
| API | Fastify + existing `authenticate` / tenant middleware |
| Web | Next.js App Router, existing fetch + Clerk session |

## File Structure Requirements

| Path | Action |
|------|--------|
| [`packages/types/src/fingerprint.ts`](../../../packages/types/src/fingerprint.ts) | **UPDATE** — confirm body schema + export merge helper (or new `fingerprint-confirm.ts` colocated) |
| [`apps/api/src/routes/v1/fingerprint.ts`](../../../apps/api/src/routes/v1/fingerprint.ts) | **UPDATE** — `POST .../confirm` |
| [`apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx`](../../../apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx) | **UPDATE** — confirm call, removals, CTA label, redirect |
| `apps/web/src/app/(onboarding)/onboarding/integrations/page.tsx` | **NEW** (recommended) |
| Tests next to changed modules | **NEW** / **UPDATE** |

## Testing Requirements

- Pure **merge** function tests must run without DB.  
- API tests follow [`apps/api/src/routes/v1/fingerprint.test.ts`](../../../apps/api/src/routes/v1/fingerprint.test.ts) patterns.  
- No live Vertex/Redis required for confirm-path CI.

## Previous Story Intelligence (2.2)

- **File:** [`2-2-fingerprinting-stream-ui-the-aha-moment.md`](./2-2-fingerprinting-stream-ui-the-aha-moment.md) — SSE-safe BFF, `buildFingerprintLines`, **`integrations-synthetic`** id, **`jobId`** lifecycle, **`ConfidenceChip`** 0–100 scaling.  
- **Completion notes:** Confirm explicitly **not** wired; **`router.push("/dashboard")`** is temporary.  
- **Open question resolved here:** confirm payload = **`overrides`** + **`removedLineIds`** + server-side merge to **`FingerprintInferencePayload`**.

## Git Intelligence Summary

Recent `main` commits are Story **1.x** infrastructure; fingerprint feature work lives on the current branch. Use **`feat: Story 2.3 — …`** convention per prior stories.

## Latest Technical Information

- **Prisma `PlatformAuditLog`:** columns fixed — use **`resource_id`** = `jobId` to correlate; payload stored in tenant **`fingerprint_results.data`**.  
- If product later requires payload in audit trail, add a **migration** (out of scope unless requested) — do not stuff JSON into `action` string.

## Project Context Reference

- No `project-context.md` found in repo at workflow time — rely on this story + [`architecture.md`](../../planning-artifacts/architecture.md) + [`epics.md`](../../planning-artifacts/epics.md).

## Dev Agent Record

### Agent Model Used

Cursor agent

### Debug Log References

### Completion Notes List

- Implemented `packages/types` confirm schema + `applyFingerprintConfirmEdits` + unit tests (`fingerprint-confirm.ts`).
- Added `POST /v1/fingerprint/:jobId/confirm` with transactional `UPDATE … RETURNING` + `platform_audit_logs` insert; 409 on stale race or already committed.
- Wired `FingerprintOnboardingClient` confirm POST, dynamic CTA label, `removedLineIds` + × in bulk edit, redirect to `/onboarding/integrations`, `sessionStorage` flag.
- Added onboarding integrations stub page; extended API + integration tests. Full `pnpm test` + `pnpm lint` pass.
- **Follow-up (post–code review):** Addressed review thread — see **Change Log → Code review resolution** for mapping of each finding to the fix.

### File List

- `packages/types/src/fingerprint-confirm.ts`
- `packages/types/src/fingerprint-confirm.test.ts`
- `packages/types/src/index.ts`
- `apps/api/src/routes/v1/fingerprint.ts`
- `apps/api/src/routes/v1/fingerprint.test.ts`
- `apps/api/src/server.ts`
- `apps/web/src/features/fingerprinting/FingerprintOnboardingClient.tsx`
- `apps/web/src/features/fingerprinting/FingerprintOnboardingClient.integration.test.tsx`
- `apps/web/src/app/(onboarding)/onboarding/integrations/page.tsx`
- `apps/web/src/app/(app)/integrations/page.tsx`

## Change Log

- **2026-05-05:** Story 2.3 implemented — fingerprint confirm API, audit log, merge helper, onboarding integrations route, client confirm flow and tests.
- **2026-05-05 (review follow-up):** Second-pass fixes per code review — `server.ts` trust proxy; `request.ip` for audit; `canRemoveFingerprintStreamLine` + `REQUIRED_LIST_EMPTY`; expanded API/web/types tests; client 409/success, `confirmBusy`, integrations shell route; details in table below.
- **2026-05-06:** Marked **done** — review comments addressed; story closed for sprint tracking.

### Code review resolution (second pass)

How the **Story 2.3 code review** feedback was addressed:

| Review theme | Resolution |
|--------------|------------|
| **Audit IP spoofing (raw `X-Forwarded-For`)** | Audit log now uses **`request.ip` only**. **`trustProxy`** is set in `apps/api/src/server.ts` when `NODE_ENV === "production"` or `TRUST_PROXY === "true"` so the forwarded chain is interpreted per Fastify’s trusted-proxy rules, not arbitrary client headers. |
| **Bulk removal → empty required lists** | **`canRemoveFingerprintStreamLine`** in `@grc/types` disables × when it would remove the last obligation / process / risk line. Server returns **`REQUIRED_LIST_EMPTY`** with Zod **`details`** when merge still fails validation; client shows that message. |
| **Test gaps** | API tests added for **`INVALID_STATE`** (queued/failed), **`DATA_CORRUPT`**, invalid schema, oversized body, **`REQUIRED_LIST_EMPTY`**, merge payload + **`toHaveBeenCalledWith`** on audit; web tests for **409 `ALREADY_COMMITTED` → redirect** and confirm body with removals; types tests for **`canRemoveFingerprintStreamLine`**. |
| **409 as success on client** | Confirm handler treats **`ALREADY_COMMITTED`** like success and navigates to **`/onboarding/integrations`**. |
| **Bulk-edit “Edited” badge** | Bulk edit **`onChange`** clears **`edited[id]`** when text matches the default line text. |
| **Zod `flatten()` on merge failure** | Post-merge validation responses include **`details: mergedParse.error.flatten()`** for **`REQUIRED_LIST_EMPTY`** / **`VALIDATION_ERROR`**. |
| **`structuredClone`** | **`cloneFingerprintPayload`** uses **`structuredClone`** with JSON clone fallback. |
| **`confirmBusy` drift** | While saving, confirm disables primary/secondary CTAs, company field, line inputs, Override flow, and bulk-edit toggle. |
| **Schema name SQL guard** | **`TENANT_SCHEMA_NAME_RE`** applied before interpolating **`schema`** into raw SQL in fingerprint routes. |
| **Success logging** | **`fastify.log.info`** after commit with **`jobId`**, **`tenantId`**, **`userId`**, **`overridesCount`**, **`removedCount`**. |
| **`/integrations` / dashboard 404** | Added **`(app)/integrations/page.tsx`** stub; **`/dashboard`** already existed. |

**Explicitly not implemented** (review “nice to have” / out of scope for this pass): undo for line removal; hardening popover ref / outside-click race (unchanged from 2.2 pattern).

## Open Questions / Clarifications

1. ~~Final URL for **integration setup**~~ — **Resolved:** redirect after confirm goes to **`/onboarding/integrations`**; full catalog stub at **`/integrations`**.  
2. ~~**`integrations-synthetic`** removable~~ — **Resolved:** removable in UI; merge helper ignores it for persisted JSON (unchanged).  
3. **Onboarding checklist** persistence — **Still Story 2.5**; fingerprint flow sets **`sessionStorage`** `grc_onboarding_fingerprint_complete` only as a lightweight signal until checklist exists.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
