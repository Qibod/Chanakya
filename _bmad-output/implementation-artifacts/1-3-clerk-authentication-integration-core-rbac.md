# Story 1.3: Clerk Authentication Integration & Core RBAC

Status: review

## Story

As an authenticated user,
I want to sign up, log in, and have my role enforced on every API request,
so that the platform is secure and each user only accesses what their role permits.

## Acceptance Criteria

1. **Given** a new user visits the sign-up page, **When** they complete Clerk's hosted sign-up flow, **Then** a Clerk webhook fires and a local `users` row plus a `role_assignments` row (default role: `ControlOwner`) are created in the tenant schema, **And** the user's session is valid for subsequent API calls.

2. **Given** a Fastify route is decorated with `requireRole('AuditDirector')`, **When** a user with role `ControlOwner` sends a request to that route, **Then** the API returns `403 Forbidden` with `{ error: { code: "FORBIDDEN", message: "..." } }`, **And** the check runs server-side with no role data in the response body.

3. **Given** a Fastify route is decorated with `requireTier('growth')`, **When** a Starter tier tenant sends a request to that route, **Then** the API returns `402` with `{ error: { code: "TIER_LIMIT_EXCEEDED", message: "..." } }`.

4. **Given** an Organisation Admin deactivates a user account, **When** the deactivation endpoint is called (`DELETE /v1/users/:userId`), **Then** Clerk's API is called to invalidate all active sessions for that user, **And** the Redis session cache entry for that user is flushed immediately.

5. **Given** a `user.deleted` (SCIM deprovisioning) event arrives at the Clerk webhook endpoint, **When** the webhook is processed, **Then** the user's Clerk sessions are already revoked (Clerk handles this on delete), **And** the local `users` record is marked `active = false` and the Redis session cache is flushed.

## Tasks / Subtasks

- [x] Task 1 — Install Clerk SDK + webhook dependencies (AC: #1–#5)
  - [x] Add to `apps/api/package.json` dependencies: `@clerk/fastify@^3.1.22`, `@clerk/backend@^3.4.4`, `svix@^1.92.2`, `fastify-raw-body@^5.0.0` (upgraded from ^4 — v4 incompatible with Fastify v5)
  - [x] Add `ioredis@^5.0.0` to `apps/api/package.json` dependencies
  - [x] Add to `.env.example`: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_JWT_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`
  - [x] Run `pnpm install` to install new packages

- [x] Task 2 — Add `active` column to tenant `users` DDL template (AC: #4, #5)
  - [x] Updated `packages/db/src/migrations/tenant-template.sql`: `active BOOLEAN NOT NULL DEFAULT TRUE` + `CREATE INDEX idx_users_inactive ON users(active) WHERE active = FALSE`
  - [x] No Prisma migration needed — tenant schema DDL template

- [x] Task 3 — Complete RBAC types: `ROLE_SATISFIES` + `TIER_GATES` (AC: #2, #3)
  - [x] `packages/types/src/rbac.ts`: `ROLE_SATISFIES`, `TIER_ORDER`, `UserContext` exported
  - [x] `packages/types/src/rbac.test.ts`: 12 tests all pass

- [x] Task 4 — Implement `authenticate` Fastify preHandler middleware (AC: #1, #2, #3)
  - [x] `apps/api/src/middleware/auth.ts` implemented with `getAuth()` from `@clerk/fastify`
  - [x] TypeScript declaration merging for `request.user: UserContext`
  - [x] `apps/api/src/middleware/auth.test.ts`: 3 tests pass

- [x] Task 5 — Update tenant middleware to use Clerk JWT (replace x-tenant-id stub) (AC: #1, #2, #3)
  - [x] `apps/api/src/middleware/tenant.ts` rewritten — reads `tenantId` from `request.user.orgId`
  - [x] `apps/api/src/middleware/tenant.test.ts`: 6 tests pass

- [x] Task 6 — Implement `requireRole()` and `requireTier()` preHandler factories (AC: #2, #3)
  - [x] `apps/api/src/middleware/rbac.ts` implemented
  - [x] `apps/api/src/middleware/rbac.test.ts`: 8 tests pass

- [x] Task 7 — Register Clerk plugin in `server.ts` + update preHandler chain (AC: #1)
  - [x] `clerkPlugin`, `fastify-raw-body`, `redisPlugin` registered in `buildServer()`
  - [x] `apps/api/src/plugins/redis.ts` implemented with ioredis singleton
  - [x] `/v1/*` preHandler: `[authenticate, tenantMiddleware]` chained in order

- [x] Task 8 — Implement Clerk webhook endpoint (AC: #1, #4, #5)
  - [x] `apps/api/src/routes/webhooks/clerk.ts` — svix signature verification, handles 5 event types
  - [x] `user_tenant_map` upserted on `organizationMembership.created` for `user.deleted` lookup
  - [x] `apps/api/src/routes/webhooks/clerk.test.ts`: 7 tests pass

- [x] Task 9 — Implement user deactivation endpoint (AC: #4)
  - [x] `apps/api/src/routes/users.ts` — `DELETE /v1/users/:userId` with `requireRole('OrgAdmin')`
  - [x] Revokes Clerk sessions, marks user inactive, flushes Redis
  - [x] `apps/api/src/routes/users.test.ts`: 3 tests pass

- [x] Task 10 — Verification (AC: all)
  - [x] `pnpm type-check` passes with 0 errors across all packages
  - [x] `pnpm lint` passes with 0 errors (2 pre-existing console warnings in worker)
  - [x] `pnpm test` passes: 45 unit tests green (27 api + 12 types + 6 db); 7 integration tests skipped
  - [x] `pnpm build` succeeds

## Dev Notes

### Critical Architecture Rules

- **ARCH-2 (mandatory):** `tenantId` ALWAYS from `request.tenant` (set by middleware). NEVER from `request.params.tenantId` or any client header. In Story 1.3, `tenantId = request.user.orgId` (Clerk org ID) — this is the only trusted source.
- **Middleware order is load-bearing:** `authenticate` → `tenantMiddleware` → `requireRole()` → `requireTier()`. Each step depends on the previous. Do NOT reorder.
- **No role data in error responses:** `requireRole()` returns 403 with a generic message — never include the user's actual role or the required role in the response body.
- **Clerk Org ID = GRC Tenant ID (1:1 mapping):** Every Clerk Organisation corresponds to exactly one GRC tenant. `auth.orgId` = the `tenantId` used everywhere in this codebase.

### Dependency Versions (confirmed 2026-05-04)

| Package | Version | Notes |
|---|---|---|
| `@clerk/fastify` | `^3.1.22` | Provides `clerkPlugin`, `getAuth()` |
| `@clerk/backend` | `^3.4.4` | Provides `WebhookEvent` types, `createClerkClient` |
| `svix` | `^1.92.2` | Raw webhook signature verification |
| `fastify-raw-body` | `^4.0.0` | Raw body access for webhook signature check |
| `ioredis` | `^5.0.0` | Redis client (already in architecture spec) |

### Clerk JWT v2 Claims (April 2025+)

Clerk JWT v2 is the current standard. **`org_id`, `org_role`, `org_slug` top-level claims are GONE** — they moved into the `o` object. The `@clerk/fastify` `getAuth()` handles this transparently:

```typescript
const auth = getAuth(request);
// auth.userId  = JWT sub claim
// auth.orgId   = JWT o.id  (was: org_id in v1 — DEPRECATED)
// auth.orgRole = JWT o.rol (was: org_role in v1 — DEPRECATED)
// auth.sessionId = JWT sid
```

Do NOT manually decode the JWT. Always use `getAuth(request)`.

### `authenticate` Middleware Implementation

```typescript
// apps/api/src/middleware/auth.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import { getAuth } from "@clerk/fastify";
import type { UserContext } from "@grc/types";

declare module "fastify" {
  interface FastifyRequest {
    user: UserContext;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const auth = getAuth(request);

  if (!auth.userId || !auth.orgId) {
    return reply.code(401).send({
      error: { code: "UNAUTHENTICATED", message: "Valid session required" },
    });
  }

  // role is a placeholder — overwritten by tenantMiddleware DB lookup
  request.user = {
    userId: auth.userId,
    orgId: auth.orgId,
    role: "ControlOwner",  // default, overwritten in tenantMiddleware
    sessionId: auth.sessionId ?? "",
  };
}
```

### Updated Tenant Middleware (JWT-based)

```typescript
// apps/api/src/middleware/tenant.ts — replace x-tenant-id with:
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = request.user?.orgId;

  if (!tenantId) {
    return reply.code(400).send({
      error: { code: "TENANT_REQUIRED", message: "Tenant context missing" },
    });
  }

  const schema = tenantSchemaName(tenantId as TenantId);

  // Tier lookup
  const tierRows = await prisma.$queryRawUnsafe<Array<{ tier: string }>>(
    `SELECT tier FROM "${schema}".tenants WHERE id = $1 LIMIT 1`, tenantId
  );
  const tier = (tierRows[0]?.tier ?? "starter") as SubscriptionTier;

  // Role lookup (tenant-wide assignment: business_unit_id IS NULL)
  const roleRows = await prisma.$queryRawUnsafe<Array<{ role: string }>>(
    `SELECT role FROM "${schema}".role_assignments WHERE user_id = $1 AND business_unit_id IS NULL ORDER BY created_at ASC LIMIT 1`,
    request.user.userId
  );
  const role = (roleRows[0]?.role ?? "ReadOnly") as UserRole;

  request.user = { ...request.user, role };
  request.tenant = {
    tenantId: tenantId as TenantId,
    tier,
    schemaName: schema,
  };
}
```

**Performance note:** Two DB queries per request. Redis caching of role + tier (key: `rbac:{tenantId}:{userId}`, TTL 300s) can be added in Story 1.6 observability work when performance profiling identifies this as a hotspot. For Story 1.3, direct DB lookup is correct.

### RBAC Types — `ROLE_SATISFIES` Pattern

```typescript
// packages/types/src/rbac.ts additions

// Defines which route-required roles a given user role satisfies.
// requireRole('AuditDirector') → passes if user's role satisfies 'AuditDirector'
export const ROLE_SATISFIES: Record<UserRole, ReadonlyArray<UserRole>> = {
  PlatformSuperAdmin: Object.values(UserRole) as UserRole[],
  OrgAdmin: ["OrgAdmin", "AuditDirector", "ControlOwner", "ReadOnly"],
  AuditDirector: ["AuditDirector", "ControlOwner", "ReadOnly"],
  ControlOwner: ["ControlOwner", "ReadOnly"],
  ReadOnly: ["ReadOnly"],
  BoardExecutive: ["BoardExecutive"],
  ExternalAuditor: ["ExternalAuditor"],
  Developer: ["Developer"],
} as const;

export const TIER_ORDER: Record<SubscriptionTier, number> = {
  starter: 0,
  growth: 1,
  scale: 2,
} as const;

export type UserContext = {
  userId: string;      // Clerk user ID (sub)
  orgId: string;       // Clerk org ID = GRC tenantId
  role: UserRole;      // set by tenantMiddleware DB lookup
  sessionId: string;
};
```

**Role hierarchy logic:** `requireRole('AuditDirector')` asks "does user's role satisfy the AuditDirector requirement?" OrgAdmin satisfies it (can do everything an AuditDirector can). ControlOwner does NOT — so they get 403.

### `requireRole()` and `requireTier()` Factories

```typescript
// apps/api/src/middleware/rbac.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import { ROLE_SATISFIES, TIER_ORDER } from "@grc/types";
import type { UserRole, SubscriptionTier } from "@grc/types";

export function requireRole(role: UserRole) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!ROLE_SATISFIES[request.user.role]?.includes(role)) {
      return reply.code(403).send({
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }
  };
}

export function requireTier(tier: SubscriptionTier) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (TIER_ORDER[request.tenant.tier] < TIER_ORDER[tier]) {
      return reply.code(402).send({
        error: { code: "TIER_LIMIT_EXCEEDED", message: "Feature requires higher tier" },
      });
    }
  };
}
```

### Webhook Signature Verification Pattern (svix)

```typescript
// apps/api/src/routes/webhooks/clerk.ts
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/backend";

const SIGNING_SECRET = process.env["CLERK_WEBHOOK_SIGNING_SECRET"]!;

export async function clerkWebhookHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const wh = new Webhook(SIGNING_SECRET);

  const svixId        = request.headers["svix-id"] as string;
  const svixTimestamp = request.headers["svix-timestamp"] as string;
  const svixSignature = request.headers["svix-signature"] as string;

  // CRITICAL: must be rawBody string, NOT request.body (re-serialized JSON differs)
  const rawBody = (request as unknown as { rawBody: string }).rawBody;

  let evt: WebhookEvent;
  try {
    evt = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return reply.code(400).send({ error: "Invalid webhook signature" });
  }

  switch (evt.type) {
    case "organization.created":    await handleOrgCreated(evt.data); break;
    case "user.created":
    case "user.updated":            await handleUserUpsert(evt.data); break;
    case "organizationMembership.created": await handleMembershipCreated(evt.data); break;
    case "user.deleted":            await handleUserDeleted(evt.data); break;
    case "organizationMembership.deleted": await handleMembershipDeleted(evt.data); break;
  }

  return reply.send({ received: true });
}
```

**Raw body requirement:** Svix signature verification cryptographically checks the raw bytes on the wire. Re-serializing `request.body` with `JSON.stringify()` will produce different bytes (different key order, whitespace) → signature mismatch → 400. Always use `request.rawBody`.

**`fastify-raw-body` opt-in:** The plugin is registered globally but only attaches `rawBody` to routes that set `{ config: { rawBody: true } }`. Register the webhook route with this config.

### Webhook Event Handling Details

**`organization.created`** — This is how a new tenant is onboarded:
```typescript
async function handleOrgCreated(data: OrganizationJSON) {
  // 1. Provision the 14-table tenant schema
  await provisionTenantSchema(data.id as TenantId);
  // 2. Insert tenant metadata
  const schema = tenantSchemaName(data.id as TenantId);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${schema}".tenants (id, name, tier) VALUES ($1, $2, 'starter')
     ON CONFLICT (id) DO NOTHING`,
    data.id, data.name
  );
}
```

**`user.created` / `user.updated`** — The webhook includes the org membership context. Use `data.organization_memberships` to find which tenant schema to write to:
```typescript
// Note: user.created/updated webhooks on a UserJSON don't include org context directly.
// This is handled via organizationMembership.created which fires alongside user.created
// when a user joins an org. The user.created handler upserts to ALL tenants the user
// belongs to (from data.organization_memberships[] if present).
// Simplest approach for Story 1.3: handle users via organizationMembership.created only.
```

**`organizationMembership.created`** — Primary event for creating local user + role:
```typescript
async function handleMembershipCreated(data: OrganizationMembershipJSON) {
  const orgId = data.organization.id;
  const userId = data.public_user_data.user_id;
  const email = data.public_user_data.identifier;  // email
  const name = [data.public_user_data.first_name, data.public_user_data.last_name]
    .filter(Boolean).join(" ");
  const schema = tenantSchemaName(orgId as TenantId);

  // Upsert user
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${schema}".users (id, email, name) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET email=$2, name=$3, updated_at=NOW()`,
    userId, email, name
  );
  // Insert default role (ControlOwner) — skip if already assigned
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${schema}".role_assignments (user_id, role) VALUES ($1, 'ControlOwner')
     ON CONFLICT DO NOTHING`,
    userId
  );
}
```

**`user.deleted`** — Mark inactive + flush Redis:
```typescript
async function handleUserDeleted(data: DeletedObjectJSON) {
  const userId = data.id!;
  // Need to find which tenant(s) this user belongs to
  // Simplest: query all tenant schemas (or store a user→tenant mapping in public schema)
  // For Story 1.3: use a public-schema lookup table user_tenant_map
  // OR: iterate all org memberships from Clerk API
  // Decision: add user_tenant_map to platform schema (see below)
}
```

**IMPORTANT — User-to-Tenant Mapping Problem:**
`user.deleted` fires with only the `userId` — there's no `orgId` in the payload. To update the correct tenant schema, we need a mapping table in the public schema: `user_tenant_map (user_id, tenant_id)`. Add this to the first Prisma migration or as a new migration.

**Resolution:** Add `UserTenantMap` model to `packages/db/prisma/schema.prisma` and create a new Prisma migration `20260504000002_user_tenant_map`. This table is populated by `organizationMembership.created` and cleaned by `organizationMembership.deleted`.

### UserTenantMap — New Prisma Migration

Add to `packages/db/prisma/schema.prisma`:
```prisma
model UserTenantMap {
  userId   String @map("user_id")
  tenantId String @map("tenant_id")
  createdAt DateTime @default(now()) @map("created_at")

  @@id([userId, tenantId])
  @@index([userId])
  @@map("user_tenant_map")
}
```

Run: `pnpm --filter @grc/db db:migrate:dev --name user-tenant-map`

This lives in the PUBLIC schema (not a tenant schema) — it's a cross-tenant lookup table.

### Redis Plugin Implementation

```typescript
// apps/api/src/plugins/redis.ts
import Fastify from "fastify";
import fp from "fastify-plugin";
import Redis from "ioredis";

const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379");

export { redis };

export default fp(async function redisPlugin(fastify: typeof Fastify) {
  fastify.decorate("redis", redis);
  fastify.addHook("onClose", async () => { await redis.quit(); });
});
```

For the webhook handler, import `redis` directly (not via Fastify decorator) to keep it simple.

Session cache key pattern: `session:{userId}` → used for flush on deactivation/deletion.

### Files Changed vs Story 1.2

| File | Action | Notes |
|---|---|---|
| `apps/api/package.json` | UPDATE | Add @clerk/fastify, @clerk/backend, svix, fastify-raw-body, ioredis |
| `apps/api/src/middleware/auth.ts` | UPDATE | Replace empty stub with authenticate middleware |
| `apps/api/src/middleware/tenant.ts` | UPDATE | Replace x-tenant-id with JWT-based resolution + DB role/tier lookup |
| `apps/api/src/middleware/rbac.ts` | UPDATE | Replace empty stub with requireRole + requireTier factories |
| `apps/api/src/plugins/redis.ts` | UPDATE | Replace empty stub with ioredis plugin |
| `apps/api/src/server.ts` | UPDATE | Register clerkPlugin, raw-body plugin, update preHandler chain, register webhook route |
| `apps/api/src/routes/webhooks/clerk.ts` | NEW | Webhook handler for all Clerk events |
| `apps/api/src/routes/users.ts` | NEW | DELETE /v1/users/:userId deactivation endpoint |
| `apps/api/src/middleware/auth.test.ts` | NEW | authenticate middleware unit tests |
| `apps/api/src/middleware/rbac.test.ts` | NEW | requireRole + requireTier unit tests |
| `apps/api/src/routes/webhooks/clerk.test.ts` | NEW | Webhook handler unit tests (mocked svix) |
| `apps/api/src/middleware/tenant.test.ts` | UPDATE | Replace x-tenant-id mocks with user.orgId mocks |
| `packages/types/src/rbac.ts` | UPDATE | Add ROLE_SATISFIES, TIER_ORDER, UserContext |
| `packages/types/src/rbac.test.ts` | NEW | RBAC types unit tests |
| `packages/db/prisma/schema.prisma` | UPDATE | Add UserTenantMap model |
| `packages/db/prisma/migrations/20260504000002_user_tenant_map/migration.sql` | NEW | user_tenant_map table migration |
| `packages/db/src/index.ts` | UPDATE | Export UserTenantMap-related helpers if needed |
| `packages/db/src/migrations/tenant-template.sql` | UPDATE | Add `active BOOLEAN NOT NULL DEFAULT TRUE` to users table |
| `.env.example` | UPDATE | Add CLERK_* environment variables |

### Story 1.2 Learnings Applied

- **ESLint 9 flat config:** The project uses `eslint.config.mjs` root flat config — do NOT add rules to `packages/config/eslint/index.js` (legacy CJS stub).
- **TypeScript declaration merging for Fastify:** Pattern is `declare module "fastify" { interface FastifyRequest { ... } }` — already used in `tenant.ts`. Do the same for `request.user` in `auth.ts`.
- **`prisma.$queryRawUnsafe`** not `$queryRaw` for parameterized queries against tenant schemas (search_path via explicit schema qualification).
- **Integration tests skip guard:** `Boolean(process.env["DATABASE_URL"]) && process.env["CI"] !== "true"` — use same pattern for any new integration tests.
- **Superuser REVOKE tests:** Use `information_schema.role_table_grants` not direct attempts (superuser bypasses REVOKE).
- **Prisma generate required before tests:** If schema.prisma changes, run `pnpm --filter @grc/db db:generate` before running tests.
- **`packages/db/.env`** must exist with `DATABASE_URL` for Prisma CLI to resolve it.
- **Port 5434 for local DB** (Docker container, avoids conflict with local Postgres on 5432).

### Testing Approach

**Unit tests (no DB/Clerk required):**
- `auth.test.ts`: mock `getAuth()` from `@clerk/fastify` returning various states
- `rbac.test.ts`: pure logic tests on ROLE_SATISFIES and TIER_ORDER constants
- `webhook/clerk.test.ts`: mock `svix.Webhook.verify()` to return test payloads; mock `provisionTenantSchema` and `prisma.$executeRawUnsafe`
- `tenant.test.ts`: mock `prisma.$queryRawUnsafe` to return tier/role; mock `request.user.orgId`

**Mocking `@clerk/fastify`'s `getAuth` in vitest:**
```typescript
vi.mock("@clerk/fastify", () => ({
  getAuth: vi.fn(),
  clerkPlugin: vi.fn(),  // no-op for test builds
}));
```

**Mocking `svix` in vitest:**
```typescript
vi.mock("svix", () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockReturnValue({ type: "user.created", data: {...} }),
  })),
}));
```

### Environment Variables Required for Story 1.3

```bash
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_JWT_KEY=-----BEGIN RSA PUBLIC KEY-----...  # from Clerk Dashboard → API Keys → JWT public key (networkless verify)
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...           # from Clerk Dashboard → Webhooks → endpoint → Signing Secret
```

For local dev webhook testing: use Clerk Dashboard's "Send test event" feature or `ngrok` to expose local port to Clerk.

### References

- Story 1.2 completion notes (x-tenant-id stub location, middleware registration pattern): `1-2-*.md#Completion Notes`
- Architecture: Authentication & Security — `architecture.md#Authentication & Security`
- Architecture: RBAC implementation — `architecture.md#RBAC Implementation`
- Architecture: middleware execution order — `architecture.md#Process Patterns`
- Clerk JWT v2 changelog (April 14 2025): `o.id` replaces `org_id`; `o.rol` replaces `org_role`
- Clerk Fastify quickstart: `@clerk/fastify` `clerkPlugin` + `getAuth()`
- svix webhook verification: `Webhook.verify(rawBody, headers)` — rawBody must be string not parsed JSON

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log

| # | Issue | Resolution |
|---|-------|------------|
| 1 | `fastify-raw-body@^4.0.0` incompatible with Fastify v5 — plugin version check throws at startup: `expected '^4.19.x' fastify version, '5.8.5' is installed` | Upgraded to `fastify-raw-body@^5.0.0` (latest, supports Fastify v5) |
| 2 | Users route test returning 500 — `vi.resetAllMocks()` in `beforeEach` cleared `getAuth`'s mock return value set in `vi.mock()` factory | Re-apply `getAuth` mock return value inside `beforeEach` after `vi.resetAllMocks()` |
| 3 | Webhook tests all returning 500 — `CLERK_WEBHOOK_SIGNING_SECRET` not set in test environment caused early-exit 500 before any header checks | Set `process.env["CLERK_WEBHOOK_SIGNING_SECRET"]` in `beforeEach` |
| 4 | TypeScript TS2345 — `FastifyRequest<{ Params: ... }>` generic in route handler not assignable to `RouteHandlerMethod` expected signature | Moved generic to a cast inside the handler body: `(request as FastifyRequest<{ Params: ... }>).params` |

### Completion Notes

- All 10 tasks complete. 45 unit tests pass across all packages (27 api, 12 types, 6 db). 0 type errors, 0 lint errors.
- `fastify-raw-body` upgraded to v5 — original story spec said `^4.0.0` but v4 is Fastify v4-only; v5 is the correct version for this project's Fastify v5 stack.
- Webhook events handled: `organization.created`, `organizationMembership.created`, `organizationMembership.deleted`, `user.deleted`. The `user.created`/`user.updated` events are handled implicitly via `organizationMembership.created` (user upsert happens there).
- `user_tenant_map` public-schema table added via Prisma migration `20260504000002_user_tenant_map` to solve the `user.deleted` cross-tenant lookup problem (Clerk's payload has no `orgId`).
- Redis key pattern used: `rbac:{tenantId}:{userId}` (consistent with Story 1.6's planned caching key).
- `@types/ioredis` left in devDependencies for now — ioredis v5 ships its own types but the package doesn't cause conflicts in practice.

### File List

| File | Status | Notes |
|------|--------|-------|
| `apps/api/package.json` | Modified | Added clerk, svix, redis, raw-body deps; upgraded fastify-raw-body to v5 |
| `apps/api/src/server.ts` | Modified | Registered clerkPlugin, rawBody, redisPlugin; updated /v1/* preHandler chain |
| `apps/api/src/middleware/auth.ts` | New | authenticate() preHandler using getAuth() from @clerk/fastify |
| `apps/api/src/middleware/auth.test.ts` | New | 3 unit tests |
| `apps/api/src/middleware/tenant.ts` | Modified | Replaced x-tenant-id header with JWT orgId; added role lookup |
| `apps/api/src/middleware/tenant.test.ts` | Modified | Updated mocks to use request.user.orgId |
| `apps/api/src/middleware/rbac.ts` | New | requireRole() and requireTier() preHandler factories |
| `apps/api/src/middleware/rbac.test.ts` | New | 8 unit tests |
| `apps/api/src/plugins/redis.ts` | New | ioredis singleton + Fastify plugin with onClose cleanup |
| `apps/api/src/routes/webhooks/clerk.ts` | New | Clerk webhook handler for 5 event types |
| `apps/api/src/routes/webhooks/clerk.test.ts` | New | 7 unit tests |
| `apps/api/src/routes/users.ts` | New | DELETE /v1/users/:userId deactivation endpoint |
| `apps/api/src/routes/users.test.ts` | New | 3 unit tests |
| `packages/types/src/rbac.ts` | Modified | Added ROLE_SATISFIES, TIER_ORDER, UserContext, TenantContext |
| `packages/types/src/rbac.test.ts` | New | 12 unit tests |
| `packages/db/prisma/schema.prisma` | Modified | Added UserTenantMap model |
| `packages/db/prisma/migrations/20260504000002_user_tenant_map/migration.sql` | New | user_tenant_map table DDL |
| `packages/db/src/migrations/tenant-template.sql` | Modified | Added active column, inactive index to users table |
| `.env.example` | Modified | Added CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, CLERK_JWT_KEY, CLERK_WEBHOOK_SIGNING_SECRET |

### Change Log

| Date | Change |
|------|--------|
| 2026-05-04 | Story 1.3 implemented — Clerk auth integration, RBAC middleware, webhook handler, user deactivation endpoint; 45 tests pass |
