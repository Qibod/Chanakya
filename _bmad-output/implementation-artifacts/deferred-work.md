# Deferred Work

## Deferred from: code review of 2-1-ai-fingerprinting-pipeline-backend-job-claude-integration (2026-05-04)

- **`tenant-template.sql` has no migration versioning or `IF NOT EXISTS` guard** — Pre-existing pattern across all tenant template migrations in this codebase. Re-running against an existing schema will error with duplicate table. Address as part of a broader migration versioning effort.
- **No 90-second end-to-end NFR latency test** — AC3 requires latency from enqueue to SSE notification < 90s. Requires e2e/load test infrastructure (k6, Playwright, etc.); out of scope for unit test suite.
- **`X-Worker-Secret` transmitted over plain HTTP in non-GCP environments** — `WORKER_HTTP_URL` defaults to `http://localhost:3002`; in containerised staging this may be plain HTTP. Requires HTTPS enforcement or mTLS at the infrastructure level (Cloud Run to Cloud Run).
- **`CloudTasksClient` instantiated per-request in `deliverFingerprintTask`** — A new gRPC client + channel is created on every POST. Refactor to a module-level singleton when request volume warrants it.

## Deferred from: code review of 1-5-design-token-system-shared-component-library (2026-05-05)

- **`no-primitive-colour` ESLint rule does not catch clsx()/cn() or template literals** — The rule only inspects static className string values; dynamic composition via `clsx`, `cn`, `cva`, or template literals bypasses it. A follow-up AST rule or a CSS-in-tokens audit script is needed to fully enforce the constraint. Track as a future linting story.

## Deferred from: code review of 3-1-control-library-list-view-status-domain-organisation (2026-05-05)

- **`frameworkProgress` ignores active status/owner filters** — The pass-rate progress card reflects all controls under the selected framework, not the filtered subset. Pre-existing data shape limitation; revisit when server-side aggregation is available.
- **"Clear all" button `aria-label`** — Button text is technically accessible but a more explicit `aria-label="Clear all filters"` would improve discoverability. Low priority; address in a future a11y sweep.

## Deferred from: code review of 3-2-real-time-compliance-dashboard-d1d2-shell (2026-05-05)

- **`sparkline30d` is a flat constant** — Current `passRatePct` repeated 30 times is meaningless as a trend. Requires a server-side time-series store (daily snapshots of domain pass rates). Defer to a dedicated history story in Epic 4/5.
- **Dashboard source query fetches all control rows without LIMIT** — Full-table scan at every 30s cache miss for tenants with 500 controls. Deferred optimisation: split into two queries — a full-table aggregate for summary counts and a `WHERE status IN ('fail','warn') LIMIT 20` for the feed.
- **`closePanel` setTimeout race** — If a second "Fix now" fires within 220ms of closing the first panel, `openerRef` is overwritten before the timeout fires, losing the focus-restore target. Pre-existing interaction edge-case; deferred.

## Deferred from: code review of 3-3-control-assignment-ai-generated-task-instructions (2026-05-05)

- **`instructionModel` hardcoded as `claude-sonnet-4-6` with `VertexAIProvider`** — If Claude-via-Vertex routing is intentional, document with a comment or extract to a named constant to avoid future confusion when the provider changes.
- **`GET /v1/controls/:id` triggers AI regeneration for ControlOwner role** — Unexpected write side-effect (AI call + 2 audit log writes) on a read endpoint gated at ControlOwner. Consider restricting regeneration to AuditDirector callers to prevent unintended AI spend from ControlOwner views.

## Deferred from: code review of 3-4-control-owner-d4-clarity-first-view-my-tasks (2026-05-05)

- **`POST /v1/my-tasks/:controlId/why-needed` has no server-side caching** — Every call creates a new AI request. Add a Redis cache keyed on `userId:controlId` with TTL ~1h to deduplicate repeated "Why is this needed?" clicks for the same task.
- **`completeMutation.onSuccess` uses `q.refetch()` instead of `qc.invalidateQueries()`** — Bypasses stale-while-revalidate; the user sees a blocking loading state after completing a task. Low priority UX improvement; replace `refetch()` with `invalidateQueries`.
- **Disabled "Start review →" button on complete cards lacks aria explanation** — Screen readers announce the button as "dimmed" without context. Add `aria-describedby` or update `aria-label` to explain the task is already complete.

## Deferred from: code review of 3-5-gap-remediation-tracking-framework-completion-progress (2026-05-05)

- **`GET /v1/gaps` has no pagination** — Returns all warn/fail controls in a single response. Acceptable at MVP scale; add cursor pagination when tenant control counts grow large (suggest same pattern as `GET /v1/controls`).
- **`csvEscape` does not handle `\r` (carriage return)** — RFC 4180 requires quoting values containing carriage returns. Add `\r` to the quoted-value condition alongside `"` and `,`.
- **`exportCsv` `<a>` element not cleaned up on error** — If `a.click()` throws (rare browser security policies), `URL.revokeObjectURL` is never called, leaking an object URL. Wrap the click in try/finally or revoke via `setTimeout(() => URL.revokeObjectURL(url), 100)`.
