# Story 3.3: Control Assignment & AI-Generated Task Instructions

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As an **Audit Director**,
I want to assign controls to specific owners with **AI-generated plain-English instructions** tailored to our integrations,
so that control owners know exactly what to do without requiring training or follow-up questions.

## Acceptance Criteria

1. **Given** an Audit Director opens a control in the `SidePanel` and clicks "Assign"  
   **When** the assignment modal opens  
   **Then** they can select an owner from a list of platform users, set an optional due date, and review the AI-generated task instruction before saving  
   **And** the modal shows which integrations are connected and notes how the instruction has been tailored to them

2. **Given** the Audit Director confirms the assignment  
   **When** `POST /v1/controls/:id/assign` is called  
   **Then** the control’s `assigned_to` field is updated and the status transitions to `in_review`  
   **And** the AI task instruction is persisted on the assignment record  
   **And** the assignment is written to `platform_audit_logs`

3. **Given** `POST /v1/controls/:id/assign` triggers AI instruction generation  
   **When** `claude-sonnet-4-6` is called synchronously via `packages/ai`  
   **Then** the instruction is returned within 5 seconds at the 95th percentile  
   **And** the prompt uses only structured metadata (control name, framework reference, connected integration names) — no raw evidence files passed to the LLM  
   **And** the instruction is in plain English with step-by-step guidance; compliance codes are never the headline

4. **Given** the tenant’s connected integrations change after a control is assigned  
   **When** the control’s assignment is next viewed  
   **Then** the AI task instruction is regenerated to reflect the current integration configuration  
   **And** the control owner is notified that their instructions have been updated

## Tasks / Subtasks

### Task 1 — Data model: persist assignments (AC: #2, #4)

- [x] Add a tenant-scoped table for assignments (new tenants + existing tenants):
  - **Update** `packages/db/src/migrations/tenant-template.sql` to add `control_assignments` (BU-scoped, nullable `business_unit_id`) and indexes.
  - **Add** a migration script for existing tenant schemas (follow prior patterns in `packages/db/src/scripts/`):
    - `packages/db/src/scripts/migrate-tenant-control-assignments-story-3-3.sql` (idempotent `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`) OR a TS migrator like `migrate-tenant-fingerprint.ts`.
- [x] Suggested `control_assignments` columns (keep minimal but future-proof):
  - `id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`
  - `control_item_id TEXT NOT NULL REFERENCES control_items(id) ON DELETE CASCADE`
  - `assigned_to TEXT NOT NULL REFERENCES users(id)`
  - `assigned_by TEXT NOT NULL REFERENCES users(id)` (Audit Director / OrgAdmin actor)
  - `due_date DATE NULL`
  - `instruction TEXT NOT NULL`
  - `instruction_model TEXT NOT NULL` (e.g. `claude-sonnet-4-6`)
  - `instruction_context JSONB NOT NULL DEFAULT '{}'::jsonb` (store `{ integrations: string[], control: { id, canonicalId, name }, frameworkRefs: string[] }`)
  - `instruction_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- [x] Add a uniqueness rule so the “current assignment” is deterministic:
  - Option A (simplest): enforce **one row per control** with `UNIQUE (control_item_id)` and always `UPDATE` it (but then you lose history).
  - Option B (preferred): allow history and mark latest as current: add `is_current BOOLEAN NOT NULL DEFAULT TRUE` and unique partial index `UNIQUE (control_item_id) WHERE is_current = TRUE`.
  - Choose **Option B** unless it materially slows implementation.

### Task 2 — API contract + RBAC for assignment (AC: #1, #2)

- [x] Create a new API endpoint `POST /v1/controls/:id/assign` in `apps/api/src/routes/v1/frameworks.ts` (same file currently owns controls routes).
- [x] RBAC/Tier:
  - **Must be callable by** `AuditDirector` (and therefore also `OrgAdmin` via `ROLE_SATISFIES`).
  - **Must NOT** be callable by `ControlOwner`.
  - Implement as a dedicated preHandler, not the existing `frameworksPreHandlers` which is currently `ControlOwner`-only.
- [x] Request body schema (in `packages/types`):
  - Add `postControlAssignBodySchema` and exported TS type.
  - Body shape:
    - `assignedTo: string` (must match an existing row in tenant `users`)
    - `dueDate?: string | null` (ISO date `YYYY-MM-DD`; stored as DATE)
  - Return `400` validation error on invalid input.
- [x] Endpoint behavior:
  - Look up connected integrations: `SELECT provider FROM integration_configs WHERE status = 'connected' ORDER BY provider`.
  - Load the control: `id`, `name`, `canonical_id`, `framework_refs`, `domain`.
  - Generate instruction synchronously via `packages/ai` provider using `claude-sonnet-4-6`.
  - In a transaction:
    - Update `control_items.assigned_to = assignedTo`, `status = 'in_review'`, `updated_at = NOW()`.
    - Upsert assignment record:
      - If using Option B (history): mark previous rows `is_current=false`, insert new row as `is_current=true`.
      - Persist `instruction`, `instruction_model`, `instruction_context`, `instruction_updated_at`.
    - Insert `PlatformAuditLog` (public schema) with:
      - `action: "control.assigned"`
      - `resourceType: "control_item"`
      - `resourceId: controlId`
      - `ipAddress` from `auditIpFromRequest` (already exists in `frameworks.ts`)
  - Response envelope: `{ data: { id, assignedTo, dueDate, status, instruction, instructionUpdatedAt, integrationsUsed } }`
  - Errors:
    - `401` if unauthenticated
    - `403` if role not allowed
    - `404` if control not found
    - `404` (or `400`) if `assignedTo` user not found in tenant `users` table

### Task 3 — AI prompt implementation (AC: #3)

- [x] Implement `packages/ai/src/prompts/task-instructions.ts` (currently a stub).
- [x] Implement a small helper in `packages/ai` to generate task instructions:
  - **Input**: `{ controlName, domain, frameworkRefs, connectedIntegrations }`
  - **Output**: `instruction: string`
  - **Constraints**:
    - plain English, step-by-step
    - 6–12 steps max (optimize for “do this in < 15 minutes”)
    - **No compliance codes as the headline** (codes may appear at the bottom under “References”)
    - include a short “What you’ll need” section if any docs/screenshots are expected
    - never mention internal table names, schema-per-tenant, or LLM model IDs
    - never request raw evidence file contents
- [x] Use provider interface (`AIProvider.complete`) and model `claude-sonnet-4-6` per `packages/ai/src/provider.ts`.
- [x] Token/time guardrails:
  - Keep `maxTokens` small enough for <5s p95 (start with 500–800).
  - If generation fails/timeouts, return a safe fallback instruction template (so the assignment can still be saved).

### Task 4 — Read path: view & regenerate instruction when integrations change (AC: #4)

- [x] Extend `GET /v1/controls/:id` response to include current assignment data:
  - `assignedTo`, `dueDate`, `instruction`, `instructionUpdatedAt`, `integrationsUsed`
- [x] On `GET /v1/controls/:id`, if a current assignment exists:
  - recompute the current connected integrations list
  - compare to stored `instruction_context.integrations`
  - if changed: regenerate instruction (same constraints/model), update assignment record (`instruction`, `instruction_context`, `instruction_updated_at`)
  - write `platform_audit_logs` action: `control.task_instruction_regenerated`
- [x] “Notify control owner” (minimal viable in 3.3, given no notification service exists yet):
  - include `instructionRegenerated: boolean` in the `GET /v1/controls/:id` response
  - write a `platform_audit_logs` row with `resourceType: "control_assignment"` so a later notifications story can fan-out to Slack/email/in-app

### Task 5 — UI: assignment modal in SidePanel (AC: #1)

- [x] Update `apps/web/src/features/controls/ControlLibraryClient.tsx` side panel to add:
  - An **“Assign”** button in the panel header or just below Status.
  - A modal (prefer shadcn/Radix dialog primitives from `@grc/ui` if available; otherwise follow established patterns but don’t reinvent accessibility).
- [x] Modal contents:
  - Owner selector populated from tenant users list.
    - Add an API endpoint for user listing if one doesn’t exist yet (prefer `GET /v1/users?role=ControlOwner` or similar).
  - Optional due date picker (simple `<input type="date">` is fine).
  - Connected integrations list (from API; show names like `okta`, `aws`, `jira`, `salesforce`, plus `manual_onboarding` if present).
  - Instruction preview area:
    - Show loading state while generating
    - Allow “Regenerate” (optional) only if cheap; otherwise omit
    - “Save assignment” posts to `POST /api/v1/controls/:id/assign`
 - [x] UX constraints:
  - Follow the existing `SidePanel` interaction: 400px width, Escape closes, focus restoration preserved, respects `prefers-reduced-motion`.
  - Avoid full-screen spinners; keep the modal responsive.

### Task 6 — Tests (API + Web) (AC: all)

- [x] API tests in `apps/api/src/routes/v1/frameworks.test.ts`:
  - `POST /v1/controls/:id/assign`:
    - 401 unauthenticated
    - 403 ControlOwner role
    - 404 control not found
    - 200 success: updates `control_items.assigned_to`, sets `status='in_review'`, writes `platform_audit_logs`, creates assignment row
  - `GET /v1/controls/:id` returns assignment details and triggers regeneration when integrations changed (mock provider to control determinism).
- [x] Web tests in `apps/web/src/features/controls/ControlLibraryClient.test.tsx`:
  - “Assign” opens modal from side panel
  - saving calls endpoint and updates UI to show assigned owner (and ideally status change)
  - a11y smoke: modal has role dialog, focus lands in modal, Escape closes and returns focus correctly

## Dev Notes

### What exists today (read before changing anything)

- Controls routes live in `apps/api/src/routes/v1/frameworks.ts`:
  - `GET /v1/controls` returns `assignedTo` + `updatedAt` (already used by the control list UI).
  - `GET /v1/controls/:id` returns control detail + framework requirement refs (no assignment info yet).
  - `PATCH /v1/controls/:id` exists only for onboarding “assign to self” (`{ assignToSelf: true }`) and is **ControlOwner-gated**.
- The control list + side panel lives in `apps/web/src/features/controls/ControlLibraryClient.tsx`.
  - Side panel currently only shows domain/status + framework requirements.
  - There is no assignment modal yet.
- Integrations “connected” state is tracked in tenant table `integration_configs` (see `packages/db/src/migrations/tenant-template.sql`) and used by onboarding route:
  - `apps/api/src/routes/v1/onboarding.ts` queries `integration_configs WHERE status='connected'`.
- AI task instruction prompt is a stub:
  - `packages/ai/src/prompts/task-instructions.ts` currently exports nothing.

### Architecture guardrails (must follow)

- **Tenant isolation**: server resolves tenant from `request.tenant` only; never trust client tenant IDs.
- **API envelope**: success `{ data: ... }`; errors `{ error: { code, message, details? } }`.
- **RBAC**: `requireRole("AuditDirector")` is the correct gate for this story’s persona (OrgAdmin will also satisfy it).
- **AI safety**: instruction prompt must use **structured metadata only**; no evidence blobs/text passed to the LLM.
- **Packages boundaries**: shared prompt logic belongs in `packages/ai`; shared request/response schemas belong in `packages/types`.

### Implementation pitfalls to avoid (learned from 3.1/3.2 reviews)

- Do not hide the assignment behind a `ControlOwner` route gate — this story is for **Audit Directors**.
- Don’t create contract drift: if you extend a response, update the canonical Zod schema in `packages/types`.
- Don’t regress a11y: reuse Radix/shadcn primitives where possible; keep focus management consistent with the existing side panel patterns.

### References

- Story source: `_bmad-output/planning-artifacts/epics.md` → “Epic 3” → “Story 3.3”
- UI to update: `apps/web/src/features/controls/ControlLibraryClient.tsx`
- API to update: `apps/api/src/routes/v1/frameworks.ts`
- AI provider interface: `packages/ai/src/provider.ts`
- Prompt stub: `packages/ai/src/prompts/task-instructions.ts`
- Tenant DDL: `packages/db/src/migrations/tenant-template.sql`
- Platform audit log table: `packages/db/prisma/migrations/20260504000000_init_platform_audit_log/migration.sql`

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

### Completion Notes List

- ✅ Added `control_assignments` table to tenant template with “single current assignment” unique index; added idempotent per-tenant migration SQL; added unit tests to ensure tenant template includes 3.3 DDL.
- ✅ Added `POST /v1/controls/:id/assign` (AuditDirector-gated) with validated body schema, assignment persistence + audit logging, and API tests.
- ✅ Implemented task-instructions prompt + `generateTaskInstructions()` helper in `@grc/ai`, with fallback behavior and tests; API now uses this helper for synchronous instruction generation.
- ✅ Extended `GET /v1/controls/:id` to return assignment details and regenerate instructions when connected integrations change (with audit-log trail).
- ✅ Added assignment modal to the control `SidePanel` with owner selection + due date, Escape-close + focus restore, and web tests.

### File List

- packages/db/src/migrations/tenant-template.sql
- packages/db/src/scripts/migrate-tenant-control-assignments-story-3-3.sql
- packages/db/src/tenant-template.test.ts
- packages/types/src/frameworks-api.ts
- apps/api/src/routes/v1/frameworks.ts
- apps/api/src/routes/v1/frameworks.test.ts
- apps/api/package.json
- apps/api/src/routes/users.ts
- packages/ai/src/index.ts
- packages/ai/src/prompts/task-instructions.ts
- packages/ai/src/task-instructions.ts
- packages/ai/src/task-instructions.test.ts
- apps/web/src/features/controls/ControlLibraryClient.tsx
- apps/web/src/features/controls/ControlLibraryClient.test.tsx

### Change Log

- 2026-05-05: Implemented control assignment persistence + API + AI prompt helper + SidePanel assignment modal, with tests.

