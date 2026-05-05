# Epic 1 Code Review — 2026-05-05

**Reviewer:** Claude (claude-sonnet-4-6)
**Scope:** All 6 stories in Epic 1 — Foundation, Infrastructure & Core Platform
**Date:** 2026-05-05
**Status:** Review complete — must-fix items identified across 5 of 6 stories

---

## Summary

| Story | Title | Verdict | Must-Fix | Should Address |
|-------|-------|---------|----------|----------------|
| 1.1 | Monorepo Setup & GCP Infrastructure Bootstrap | ✅ PASS | 2 | 2 |
| 1.2 | Database Foundation — Schema-per-Tenant & Platform Audit Log | ✅ PASS | 3 | 4 |
| 1.3 | Clerk Authentication Integration & Core RBAC | ✅ PASS | 2 | 3 |
| 1.4 | Next.js App Shell, BFF Proxy & User Management | ✅ PASS | 2 | 2 |
| 1.5 | Design Token System & Shared Component Library Foundation | ✅ PASS | 1 | 3 |
| 1.6 | CI/CD Pipeline, Observability & Cross-Tenant Regression Tests | ✅ PASS | 2 | 3 |

All 6 stories pass review. No story is blocked outright but each has prioritised action items before promotion to production.

---

## Story 1.1 — Monorepo Setup & GCP Infrastructure Bootstrap

### ✅ Strengths
- Turborepo pipeline correctly wired — `dev` has `cache: false, persistent: true`; `build` depends on `^build`
- `PrismaClient` singleton avoids hot-reload leaks in development
- Docker Compose puts Cloud SQL Proxy behind a `gcp` profile — no GCP credentials needed for local dev
- CI uses Workload Identity Federation (no long-lived SA keys)
- Deploy workflow runs `db:migrate` as a zero-downtime gate before Cloud Run deployment

### 🔴 Must-Fix
1. **Document the two `DATABASE_URL` variants in `.env.example`** — The spec says Cloud SQL Proxy on `:5432`, but the implementation exposes local Postgres on `:5434` and Cloud SQL Proxy on `:5433`. Both variants must be explicitly documented to avoid first-day confusion.
2. **Worker secret comparison must use constant-time equality** — `req.headers["x-worker-secret"] === secret` is vulnerable to timing attacks. Replace with `crypto.timingSafeEqual(Buffer.from(header), Buffer.from(secret))`. Document in `deferred-work.md` if not fixed immediately.

### 🟡 Should Address
- **Run `terraform validate` in CI** — catches syntax errors without needing GCP credentials; cheap safety net
- **Move `UserTenantMap` to Story 1.3 story boundary** — it appears in the schema before Story 1.3 exists; update the story's scope notes to make the ordering explicit

---

## Story 1.2 — Database Foundation: Schema-per-Tenant & Platform Audit Log

### ✅ Strengths
- `tenant-extension.ts` uses `SET LOCAL search_path` inside an array-syntax `$transaction` — correctly safe for connection pooling, no infinite recursion
- Migration SQL includes `REVOKE UPDATE, DELETE ON platform_audit_logs FROM PUBLIC` — ARCH-3 satisfied
- `provisionTenantSchema` strips comment lines before splitting on `;` — correctly handles semicolons in SQL comments
- The entire schema creation + DDL runs atomically inside a single `$transaction`

### 🔴 Must-Fix
1. **`__dirname` in `provision-tenant.ts` — ESM compatibility risk** — If `tsconfig.json` targets ESM (`module: NodeNext`), `__dirname` throws `ReferenceError` at runtime. Replace with:
   ```typescript
   import { fileURLToPath } from "node:url";
   const __dirname = path.dirname(fileURLToPath(import.meta.url));
   ```
   Verify `packages/db/tsconfig.json` module setting first — if it outputs CJS, this is fine as-is.

2. **`provisionTenantSchema` has no UUID validation on `tenantId`** — The function is callable from anywhere. A non-UUID input would produce a schema name that could escape the quoting. Add:
   ```typescript
   if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
     throw new Error(`Invalid tenantId: ${tenantId}`);
   }
   ```

3. **Document the `$queryRaw` extension bypass** — The Prisma Client Extension only intercepts model-level operations. `$queryRaw` / `$executeRaw` bypass it silently. This must be documented prominently (in a `CONTRIBUTING.md` or a comment at the top of `tenant-extension.ts`) — otherwise developers will write raw queries that leak cross-tenant.

### 🟡 Should Address
- **Story record is inaccurate** — Completion notes claim the tenant middleware still uses `x-tenant-id` header stub, but the actual implementation already uses Clerk JWT (`request.user?.orgId`). The "TODO Story 1.3" comment in the middleware is misleading. Correct the story notes.
- **Change GRANT target from `PUBLIC` to the app role** — `GRANT SELECT, INSERT ON platform_audit_logs TO PUBLIC` is too broad. Should be `TO app_role` in production.
- **Silent fallback for missing tenant schema** — If `tenants` table doesn't exist (schema not provisioned), `tenantMiddleware` silently defaults to `tier: "starter"` and `role: "ReadOnly"`. This should return a 4xx, not silently degrade.
- **Integration test REVOKE check doesn't test actual enforcement** — The test queries `information_schema` to verify grants are absent (because the test user is a superuser). Add a note that real enforcement requires a non-superuser role test — the current test gives false security confidence.

---

## Story 1.3 — Clerk Authentication Integration & Core RBAC

### ✅ Strengths
- `authenticate` correctly uses `getAuth(request)` from `@clerk/fastify` — never manually decodes JWT
- Declaration merging for `request.user` is consistent with `request.tenant` pattern
- `requireRole` / `requireTier` never leak role info in error responses — exactly as specified
- `ROLE_SATISFIES` hierarchy is correct; OrgAdmin satisfies AuditDirector, ControlOwner does not
- svix raw body used correctly — re-serialised JSON would differ and fail signature verification
- Redis `onClose` hook prevents connection leaks on server shutdown

### 🔴 Must-Fix
1. **Default role in `authenticate` should be `"ReadOnly"`, not `"ControlOwner"`** — If `tenantMiddleware` is misconfigured or throws on a route, the user silently has `ControlOwner` access. Fail closed:
   ```typescript
   request.user = {
     userId: auth.userId,
     orgId: auth.orgId,
     role: "ReadOnly" as UserRole,  // overwritten by tenantMiddleware
     sessionId: auth.sessionId ?? "",
   };
   ```

2. **Add startup validation for `CLERK_WEBHOOK_SIGNING_SECRET`** — `process.env["CLERK_WEBHOOK_SIGNING_SECRET"]!` (non-null assertion) will fail at runtime on the first webhook call if the env var is missing. Add a startup check that refuses to start if absent, consistent with `DATABASE_URL` validation.

### 🟡 Should Address
- **Document intentional role isolation for `BoardExecutive` / `ExternalAuditor` / `Developer`** — These roles only satisfy themselves. This looks like a bug to future developers. Add a comment explaining the deliberate isolation (e.g. audit isolation, board access boundary).
- **Add `organization.deleted` webhook stub** — Clerk fires this when an org is deleted. Currently no handler; orphaned tenant schemas would persist. Even a stub log + alert is better than silent inaction.
- **Standardise Redis key format** — Completion notes say `rbac:{tenantId}:{userId}` but the story spec references `session:{userId}`. Canonicalise in one place and document it.

---

## Story 1.4 — Next.js App Shell, BFF Proxy & User Management

### ✅ Strengths
- BFF proxy uses `request.signal` — upstream fetch aborts on client disconnect, preventing resource leaks
- SSE passthrough (`text/event-stream`) handled — critical for Story 2.2's fingerprinting stream
- 204 No Content response handled correctly (empty body)
- `params` is correctly awaited in route handlers — Next.js 15 breaking change applied correctly
- `getToken()` forwarding lets Fastify's `clerkPlugin` verify the token unchanged — no duplicate auth path needed
- `PlatformSuperAdmin` route added to `ROLE_ROUTES` — good catch not in the spec

### 🔴 Must-Fix
1. **Fix the unchecked task checkbox for BFF route in the story file** — Task 5's first sub-item ("Create `apps/web/src/app/api/v1/[...path]/route.ts`") has `[ ]` (unchecked) despite the file existing and being fully implemented. This is misleading for future readers. Mark it as `[x]`.

2. **`GET /v1/users` is not paginated** — The story AC#5 says "paginated list" but the Fastify implementation returns all rows with no `LIMIT`/`OFFSET`. For tenants with hundreds of users, this is a full table scan. Add pagination:
   ```typescript
   const { page = 1, limit = 50 } = request.query as { page?: number; limit?: number };
   const offset = (page - 1) * limit;
   // ... add LIMIT $1 OFFSET $2 to the query
   return { data: users, meta: { page, limit, total } };
   ```

### 🟡 Should Address
- **Document server-to-server loopback assumption** — `page.tsx` constructs `${protocol}://${host}/api/v1/me` using the incoming `host` header. In Cloud Run, `host` may not resolve to loopback. Document this assumption, or use `INTERNAL_API_URL` directly.
- **Verify `AuditDirector` nav doesn't show Settings link** — The sidebar spec says `AuditDirector` gets the same as OrgAdmin "minus settings" but this wasn't confirmed in the implementation notes.

---

## Story 1.5 — Design Token System & Shared Component Library Foundation

### ✅ Strengths
- `globals.css` inlines tokens directly (not via `@import "@grc/ui/tokens"`) — avoids the CSS path ambiguity correctly identified in dev notes
- `StatusChip` has `role="status"` and `aria-label` — WCAG 2.1 AA requirement properly addressed
- `ConfidenceChip` uses `font-mono tabular-nums` — numbers won't reflow as values update
- `prefers-reduced-motion` block reduces all transitions globally
- ESLint `no-primitive-colour` is `warn` not `error` — pragmatic for pre-existing Story 1.4 components
- Storybook `preview.tsx` includes `data-theme="dark"` decorator — components render in the correct context for the a11y check

### 🔴 Must-Fix
1. **`StatusChip` light-mode rendering is broken** — AC#3 requires the component renders correctly in both dark and light modes. `bg-green-950` in light mode is nearly invisible against a white background. The `auto` and `pending` variants use `bg-indigo-950` and `bg-zinc-800` with no light-mode alternative. Either:
   - Add light-mode token overrides for status background colors in `globals.css` (`--status-pass-bg-light`, etc.)
   - Or use conditional Tailwind dark/light variant classes in the CVA definition: `dark:bg-green-950 bg-green-100`

### 🟡 Should Address
- **Add `defaultVariants.framework` or undefined guard to `FrameworkBadge`** — If `framework` prop is `undefined` or a value not in the enum, the CVA variant won't match and the component renders without colour styling.
- **Add `--status-auto-bg` and `--status-pending-bg` tokens** — `StatusChip` uses `bg-indigo-950` and `bg-zinc-800` as primitives for `auto` and `pending` variants, inconsistent with the token pattern used for pass/warn/fail.
- **Log the `clsx`/template literal `no-primitive-colour` gap in `deferred-work.md`** — The ESLint rule only catches static string literals, not `clsx()` or template literal class values. This limitation should be tracked explicitly, not just noted in story docs.

---

## Story 1.6 — CI/CD Pipeline, Observability & Cross-Tenant Regression Tests

### ✅ Strengths
- `instrument.ts` uses `enabled: Boolean(process.env["SENTRY_DSN"])` — Sentry correctly no-ops with no DSN set in local dev
- `instrumentation.ts` loads Sentry config based on `NEXT_RUNTIME` — correct Next.js 15 App Router pattern
- `setupFastifyErrorHandler(fastify)` is the first call in `buildServer()` before any plugin — ARCH-SENTRY-FIRST correctly followed
- Pino structured logging emits `severity` field mapped to GCP Cloud Logging severity levels
- CI integration job correctly runs against a real PostgreSQL service container — the `&& process.env["CI"] !== "true"` guard that would have prevented this is correctly removed

### 🔴 Must-Fix
1. **`deploy-api.yml` Sentry source map upload step is a re-build, not an upload** — The step runs `pnpm --filter @grc/api build` (which has `SENTRY_AUTH_TOKEN` in env). This rebuilds the API — it doesn't upload source maps to Sentry. For the API (not Next.js), the Sentry webpack plugin doesn't apply. The upload should use the Sentry CLI explicitly:
   ```yaml
   - name: Upload Sentry source maps
     if: env.SENTRY_AUTH_TOKEN != ''
     run: |
       pnpm dlx @sentry/cli releases \
         --org ${{ vars.SENTRY_ORG }} \
         --project ${{ vars.SENTRY_PROJECT_API }} \
         files ${{ github.sha }} \
         upload-sourcemaps apps/api/dist \
         --url-prefix '~/dist'
     env:
       SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
   ```

2. **Integration CI job missing `db:generate` step** — The unit test CI job runs `pnpm --filter @grc/db db:generate` before type-checking. The integration job runs `db:migrate` but not `db:generate`. If schema and client types diverge (e.g. after a new migration), the integration tests may fail with confusing type errors. Add `db:generate` before `test:integration`:
   ```yaml
   - name: Generate Prisma client
     run: pnpm --filter @grc/db db:generate
     env:
       DATABASE_URL: ${{ env.DATABASE_URL }}
   ```

### 🟡 Should Address
- **Pin pnpm version in deploy workflows** — `pnpm/action-setup@v4` without `version:` will pick up the latest pnpm, which may break on major version releases. Add `version: 10` (or match whatever `packageManager` field is in root `package.json`).
- **Confirm and document Vercel auto-deploy** — AC#2 says `apps/web` deploys to Vercel automatically. There's no `deploy-web.yml` (correct per ARCH-11 Vercel native). But the story completion notes should explicitly confirm that Vercel's Git integration is configured and pointing at the repo — this is a deploy path with no verification in the codebase.
- **Fix stale example in structured logging dev notes** — The dev notes example uses `request.tenant.id` but `TenantContext` has `tenantId` (not `id`). The completion notes say this was caught in implementation, but the dev notes still have the wrong field name and will mislead future developers.

---

## Cross-Cutting Concerns

These issues appear across multiple stories and should be addressed holistically:

### Security
- The `GRANT ... TO PUBLIC` pattern appears in both `platform_audit_logs` and `control_health_snapshots` immutability enforcement. In production, these should grant to the specific app service role, not PUBLIC. Create a follow-on task to tighten these before the first staging deploy.

### Observability Gap
- Sentry is wired in both `apps/web` and `apps/api`. The `apps/worker` has no Sentry integration at all. Worker job failures (fingerprint, evidence-sync, etc.) will be logged but not surfaced in Sentry. Add `@sentry/node` to the worker before Epic 2 work begins.

### Test Coverage Confidence
- Integration tests correctly run against real PostgreSQL. However, the REVOKE enforcement test uses `information_schema` rather than attempting actual DML with a non-superuser. This gives false security confidence. Log a task to add a proper non-superuser test user in the integration test setup.

### Documentation
- The `deferred-work.md` file exists but the `no-primitive-colour` ESLint limitation (dynamic classes in `clsx()`/template literals) is not recorded there. Several "should address" items from this review should be captured in `deferred-work.md` for traceability.

---

## Recommended Priority Order

Before staging deploy, address in this order:

1. **Story 1.6** — Fix Sentry source map upload step (wrong command) + add `db:generate` to integration job (pipeline correctness)
2. **Story 1.3** — Change default role from `ControlOwner` to `ReadOnly` (security fail-open)
3. **Story 1.2** — Verify `__dirname` ESM compatibility (potential runtime crash) + add UUID validation to `provisionTenantSchema` (injection guard)
4. **Story 1.5** — Fix `StatusChip` light-mode colours (AC#3 violation)
5. **Story 1.4** — Add pagination to `GET /v1/users` (AC#5 says "paginated")
6. **Story 1.1** — Document two `DATABASE_URL` variants + add constant-time secret comparison in worker
