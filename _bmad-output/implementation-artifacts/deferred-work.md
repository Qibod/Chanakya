# Deferred Work

## Deferred from: code review of 2-1-ai-fingerprinting-pipeline-backend-job-claude-integration (2026-05-04)

- **`tenant-template.sql` has no migration versioning or `IF NOT EXISTS` guard** — Pre-existing pattern across all tenant template migrations in this codebase. Re-running against an existing schema will error with duplicate table. Address as part of a broader migration versioning effort.
- **No 90-second end-to-end NFR latency test** — AC3 requires latency from enqueue to SSE notification < 90s. Requires e2e/load test infrastructure (k6, Playwright, etc.); out of scope for unit test suite.
- **`X-Worker-Secret` transmitted over plain HTTP in non-GCP environments** — `WORKER_HTTP_URL` defaults to `http://localhost:3002`; in containerised staging this may be plain HTTP. Requires HTTPS enforcement or mTLS at the infrastructure level (Cloud Run to Cloud Run).
- **`CloudTasksClient` instantiated per-request in `deliverFingerprintTask`** — A new gRPC client + channel is created on every POST. Refactor to a module-level singleton when request volume warrants it.

## Deferred from: code review of 1-5-design-token-system-shared-component-library (2026-05-05)

- **`no-primitive-colour` ESLint rule does not catch clsx()/cn() or template literals** — The rule only inspects static className string values; dynamic composition via `clsx`, `cn`, `cva`, or template literals bypasses it. A follow-up AST rule or a CSS-in-tokens audit script is needed to fully enforce the constraint. Track as a future linting story.
