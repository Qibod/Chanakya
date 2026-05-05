# Story 1.4: Next.js App Shell, BFF Proxy & User Management

Status: review

## Story

As an authenticated user,
I want to land on the correct view for my role and navigate the platform shell,
So that I only see what is relevant to my responsibilities from first login.

## Acceptance Criteria

1. **Given** an authenticated Audit Director (or OrgAdmin) navigates to the app root, **When** the shell renders, **Then** they are routed to `/dashboard` and see the sidebar with all navigation items for their role, **And** the sidebar is `240px` wide with icon + label, collapsible to `56px` icon-only on toggle.

2. **Given** an authenticated Control Owner navigates to the app root, **When** the shell renders, **Then** they are routed to `/my-tasks` and see the D4 Clarity First view — not the full D1+D2 shell.

3. **Given** an authenticated Developer navigates to the app root, **When** the shell renders, **Then** they are routed to `/developer` with only developer-relevant navigation visible.

4. **Given** the Next.js BFF API route receives a request requiring Fastify data, **When** a server component or client calls the BFF proxy, **Then** the request is forwarded to Fastify with `Authorization: Bearer {API_SERVICE_ACCOUNT_TOKEN}` and the response is returned to the client without exposing the token to the browser.

5. **Given** an Organisation Admin navigates to Settings → Team, **When** the user management page loads, **Then** they can view all users with their current roles and status (active/inactive), **And** they can change a user's role from a dropdown which persists via `PATCH /v1/users/:id`, **And** they can deactivate a user which immediately invalidates their session.

## Tasks / Subtasks

- [x] Task 1 — Install dependencies in `apps/web` (AC: #1–#5)
  - [x] Add `@clerk/nextjs@^7.2.7` to `apps/web/package.json` dependencies
  - [x] Add `@tanstack/react-query@^5.100.9` to `apps/web/package.json` dependencies
  - [x] Add `zustand@^5.0.0` to `apps/web/package.json` dependencies
  - [x] Add `lucide-react@^0.469.0` to `apps/web/package.json` dependencies (icons — no icon package installed yet)
  - [x] Run `pnpm install`

- [x] Task 2 — Add `GET /v1/me` and `GET /v1/users` + `PATCH /v1/users/:id` to Fastify API (AC: #4, #5)
  - [x] Add `GET /v1/me` to `apps/api/src/routes/users.ts` — preHandler `[authenticate, tenantMiddleware]`; returns `{ userId, orgId, role, tier }`
  - [x] Add `GET /v1/users` to `apps/api/src/routes/users.ts` — preHandler `[authenticate, tenantMiddleware, requireRole('OrgAdmin')]`; returns paginated list of users from `"${schema}".users` with their `role_assignments.role` and `active` status
  - [x] Add `PATCH /v1/users/:id` to `apps/api/src/routes/users.ts` — preHandler `[authenticate, tenantMiddleware, requireRole('OrgAdmin')]`; accepts `{ role: UserRole }`; upserts `role_assignments` and flushes Redis cache `rbac:{tenantId}:{userId}`
  - [x] Unit tests for all three endpoints in `apps/api/src/routes/users.test.ts`

- [x] Task 3 — Clerk Middleware (AC: #1–#3)
  - [x] Create `apps/web/src/middleware.ts` using `clerkMiddleware` + `createRouteMatcher` from `@clerk/nextjs/server`
  - [x] Protect routes: all `/dashboard(.*)`, `/my-tasks(.*)`, `/controls(.*)`, `/settings(.*)`, `/developer(.*)`, `/audits(.*)`, `/evidence(.*)`, `/risk(.*)`, `/integrations(.*)`, `/reports(.*)`
  - [x] Public routes: `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks/(.*)`; root `/` is also public (handled by redirect logic in the page itself)
  - [x] Config `matcher`: `['/((?!_next/static|_next/image|favicon.ico).*)']`

- [x] Task 4 — Root layout + Providers (AC: #1–#3)
  - [x] Update `apps/web/src/app/layout.tsx`: wrap with `ClerkProvider` (with `dynamic` prop) from `@clerk/nextjs`
  - [x] Create `apps/web/src/app/providers.tsx` (client component): `QueryClientProvider` with `QueryClient` (staleTime: 60s, gcTime: 5min)
  - [x] Nest: `ClerkProvider > Providers > children` in root layout
  - [x] Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` env var reference (already in `.env.example`)
  - [x] Create `apps/web/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` and `apps/web/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` — render Clerk's `<SignIn />` / `<SignUp />` components centered on page
  - [x] Set Clerk env vars in `.env.example` if not already present: `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/`

- [x] Task 5 — BFF proxy catch-all route (AC: #4)
  - [x] Create `apps/web/src/app/api/v1/[...path]/route.ts`
  - [x] Handle all HTTP methods: GET, POST, PATCH, DELETE, PUT
  - [x] Use `auth()` from `@clerk/nextjs/server` to verify the user is signed in; return 401 if not
  - [x] Forward request to `${process.env.INTERNAL_API_URL}/v1/${path.join('/')}` with:
    - `Authorization: Bearer ${process.env.API_SERVICE_ACCOUNT_TOKEN}` — SA token for Fastify
    - `x-clerk-user-id`: forwarded user ID (Fastify uses Clerk plugin to verify real JWT; SA token is for trusted network, not Clerk JWT)
    - All original query params from the client request
    - Body forwarded as-is for POST/PATCH/PUT
  - [x] In Next.js 15: `params` is a `Promise` — `const { path } = await params`
  - [x] Return upstream response status + body verbatim; pass through error codes (401, 403, 404, etc.)
  - [x] Do NOT use `NextResponse.next()` inside Route Handlers — always return a full response

  > **CRITICAL ARCHITECTURAL NOTE — BFF Auth Model:**
  > The BFF sits between browser and Fastify. The browser sends its Clerk session cookie to the BFF.
  > The BFF uses `auth()` from `@clerk/nextjs/server` to extract `userId` + `orgId`.
  > The BFF then calls Fastify with `Authorization: Bearer {API_SERVICE_ACCOUNT_TOKEN}`.
  > Fastify's `authenticate` middleware currently calls `getAuth(request)` from `@clerk/fastify`.
  > For the BFF pathway, Fastify needs a way to trust the BFF's request without a real Clerk JWT.
  > **Implementation choice for Story 1.4:** Pass the user's actual Clerk session token from the BFF to Fastify.
  > Extract the session token from the `__session` cookie or use `getToken()` from Clerk's auth helper.
  > Forward it as `Authorization: Bearer {clerkSessionToken}` so Fastify's existing `clerkPlugin` verifies it normally.
  > `API_SERVICE_ACCOUNT_TOKEN` is for production Cloud Run service account auth (future); for dev, Clerk token forwarding suffices.

- [x] Task 6 — Role-based root page redirect (AC: #1–#3)
  - [x] Update `apps/web/src/app/page.tsx` to a server component that:
    1. Calls `auth()` from `@clerk/nextjs/server` — if not signed in, redirect to `/sign-in`
    2. If signed in, fetch `GET /api/v1/me` (internal fetch to BFF route handler) to get `{ role }`
    3. Redirect based on role: `OrgAdmin|AuditDirector → /dashboard`, `ControlOwner → /my-tasks`, `Developer → /developer`, `ReadOnly|BoardExecutive|ExternalAuditor → /dashboard` (fallback)
  - [x] For the internal BFF call from server component, pass the request cookies: `fetch('/api/v1/me', { headers: { cookie: request.cookies } })` — or use `headers()` from `next/headers`
  - [x] Create `apps/web/src/features/auth/queries.ts` — `queryKey: ['me']`, `queryFn` calls `/api/v1/me`

- [x] Task 7 — App shell layout: `(app)/layout.tsx` (AC: #1–#3)
  - [x] Create `apps/web/src/app/(app)/layout.tsx` — server component (wraps authenticated pages)
  - [x] Three-column CSS Grid: `grid-cols-[240px_1fr_280px]` at ≥1280px; sidebar collapses to 56px icon-only below 1280px; right panel hidden below 1280px
  - [x] Import `Sidebar` and `TopNav` components from `@/components/layout/`
  - [x] Shell passes the user's role (fetched from BFF `/api/v1/me`) as a prop to `Sidebar` for role-gated nav items
  - [x] Sidebar collapse state managed in `Zustand` store: `apps/web/src/store/ui.ts` — `{ sidebarCollapsed: boolean, toggleSidebar: () => void }`
  - [x] Responsive: `grid-cols-[56px_1fr]` at 1024–1279px; `grid-cols-[0px_1fr]` (sidebar overlay) at <1024px

- [x] Task 8 — Sidebar component (AC: #1–#3)
  - [x] Create `apps/web/src/components/layout/Sidebar.tsx` (client component — uses Zustand for collapse state)
  - [x] Width: `240px` expanded, `56px` collapsed (CSS transition `transition-width 200ms ease-out`)
  - [x] Nav item height: `44px` (accessibility: meets touch target minimum)
  - [x] Active item: indigo-tinted background + left border accent (Tailwind: `bg-indigo-500/10 border-l-2 border-indigo-500 text-indigo-400`)
  - [x] Role-gated navigation items:
    ```
    OrgAdmin/AuditDirector: Dashboard, Controls, Evidence, Audits, Risk, Integrations, Reports, Settings
    ControlOwner:           My Tasks, Controls (own), Evidence (own)
    Developer:              Developer Portal
    ReadOnly:               Dashboard (read-only), Controls
    ```
  - [x] Use `lucide-react` icons: `LayoutDashboard`, `Shield`, `FileCheck`, `ClipboardList`, `AlertTriangle`, `Plug`, `BarChart3`, `Settings`, `Code`, `CheckSquare`
  - [x] Collapsed state: show icons only, no labels
  - [x] Toggle button at bottom of sidebar: `ChevronLeft` / `ChevronRight` from lucide-react
  - [x] Sidebar items use Next.js `<Link>` from `next/link`; `usePathname()` from `next/navigation` for active state

- [x] Task 9 — TopNav component (AC: #1)
  - [x] Create `apps/web/src/components/layout/TopNav.tsx` (client component)
  - [x] Right side: `<UserButton />` from `@clerk/nextjs` (Clerk's built-in user menu with sign-out)
  - [x] Left side: page title (passed as prop)
  - [x] Full width, `h-14`, `border-b border-slate-800 bg-slate-900`

- [x] Task 10 — Route page stubs + User Management (AC: #1–#3, #5)
  - [x] Create `apps/web/src/app/(app)/dashboard/page.tsx` — stub: `<h1>Dashboard</h1>` (D1+D2 shell — full implementation in Story 3.2)
  - [x] Create `apps/web/src/app/(app)/my-tasks/page.tsx` — stub: `<h1>My Tasks</h1>` (D4 Clarity First — Story 3.4)
  - [x] Create `apps/web/src/app/(app)/developer/page.tsx` — stub: `<h1>Developer Portal</h1>`
  - [x] Create `apps/web/src/app/(app)/settings/team/page.tsx` — **full implementation** (AC #5):
    - Server component: fetch `GET /api/v1/users` via BFF → render `UserTable` client component
    - `UserTable`: columns: Name, Email, Role (dropdown), Status (badge), Actions (Deactivate button)
    - Role dropdown: `<select>` with all `UserRole` values; `onChange` calls `PATCH /api/v1/users/:id` via `useMutation`
    - Deactivate button: calls `DELETE /api/v1/users/:id`; disabled if user is self (prevent self-deactivation)
    - On successful mutation: `queryClient.invalidateQueries({ queryKey: ['users'] })`
    - Error handling: display toast/alert on failure

- [x] Task 11 — Auth feature hooks (AC: #1–#3)
  - [x] Create `apps/web/src/features/auth/hooks.ts`
  - [x] `useMe()`: `useQuery({ queryKey: ['me'], queryFn: () => fetch('/api/v1/me').then(r => r.json()) })`
  - [x] `useRole()`: wraps `useMe()`, returns `data?.role as UserRole | undefined`
  - [x] Create `apps/web/src/features/auth/index.ts` — re-exports

- [x] Task 12 — Verification (AC: all)
  - [x] `pnpm --filter @grc/web type-check` passes with 0 errors
  - [x] `pnpm --filter @grc/web lint` passes with 0 errors
  - [x] `pnpm --filter @grc/web build` succeeds (Next.js production build)
  - [x] `pnpm --filter @grc/api test` still passes (new routes don't break existing tests)

## Dev Notes

### Critical Architecture Rules

- **ARCH-1 (BFF mandatory):** Browser → Next.js BFF (`/api/v1/...`) → Fastify. NEVER direct browser → Fastify. The `API_SERVICE_ACCOUNT_TOKEN` / Clerk token never leaves the server.
- **ARCH-2 (tenant from JWT):** `tenantId` always from Clerk `orgId`. The BFF forwards the Clerk session token to Fastify so `authenticate` + `tenantMiddleware` resolve normally.
- **ARCH-3 (Next.js 15):** `params` in Route Handlers is a `Promise`. Must `await params` before accessing properties. This is a breaking change from Next.js 14.
- **ARCH-4 (App Router):** All files in `app/` are Server Components by default. Add `'use client'` only for components using hooks, browser APIs, or event handlers. Zustand store and TanStack Query hooks require `'use client'`.
- **No shared UI components yet:** `packages/ui` is empty until Story 1.5. Story 1.4 uses inline Tailwind classes and local components. Do NOT try to import from `@grc/ui` (nothing exported yet).

### Dependency Versions (confirmed 2026-05-04)

| Package | Version | Notes |
|---|---|---|
| `@clerk/nextjs` | `^7.2.7` | `ClerkProvider`, `clerkMiddleware`, `useUser()`, `auth()` |
| `@tanstack/react-query` | `^5.100.9` | v5 API — all queries use object syntax, `isPending` not `isLoading` |
| `zustand` | `^5.0.0` | UI state: sidebar collapse |
| `lucide-react` | `^0.469.0` | Icons — shadcn/ui default icon set |

### Next.js 15 Breaking Changes to Watch

1. **`params` is a Promise** in Route Handlers AND page/layout props:
   ```typescript
   // Route Handler (app/api/v1/[...path]/route.ts)
   export async function GET(
     request: NextRequest,
     { params }: { params: Promise<{ path: string[] }> }
   ) {
     const { path } = await params  // MUST await
   }
   
   // Page component
   export default async function Page({
     params,
   }: {
     params: Promise<{ id: string }>
   }) {
     const { id } = await params  // MUST await
   }
   ```

2. **`fetch` is NOT cached by default** in Next.js 15 (changed from v14). For BFF proxy routes, this is desirable (`cache: 'no-store'` is now the implicit default).

3. **`cookies()` and `headers()` from `next/headers` are async** in Next.js 15:
   ```typescript
   import { cookies, headers } from 'next/headers'
   const cookieStore = await cookies()  // MUST await
   const headersList = await headers()  // MUST await
   ```

### `@clerk/nextjs` v7 Key Patterns

**Root layout with ClerkProvider:**
```typescript
// apps/web/src/app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider dynamic>
      <html lang="en">
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

**Middleware (`apps/web/src/middleware.ts`):**
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/my-tasks(.*)',
  '/controls(.*)',
  '/settings(.*)',
  '/developer(.*)',
  '/audits(.*)',
  '/evidence(.*)',
  '/risk(.*)',
  '/integrations(.*)',
  '/reports(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Server-side auth in Server Component:**
```typescript
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function Page() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  // orgId is the GRC tenantId
}
```

**Client hooks:**
```typescript
'use client'
import { useUser, useOrganization } from '@clerk/nextjs'

const { user, isLoaded } = useUser()
const { organization } = useOrganization()
```

### BFF Proxy Implementation

The proxy forwards the user's Clerk session token to Fastify (Fastify's `clerkPlugin` verifies it normally). This avoids needing to change Fastify's auth model for Story 1.4.

```typescript
// apps/web/src/app/api/v1/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path } = await params
  const token = await getToken()  // Clerk session JWT
  
  const upstreamUrl = new URL(
    `/v1/${path.join('/')}`,
    process.env.INTERNAL_API_URL ?? 'http://localhost:3001'
  )
  // Forward query params
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value)
  })

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  const data = await upstream.json()
  return NextResponse.json(data, { status: upstream.status })
}

// Repeat for POST, PATCH, DELETE — include body forwarding
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path } = await params
  const token = await getToken()
  const body = await request.json()

  const upstream = await fetch(
    `${process.env.INTERNAL_API_URL ?? 'http://localhost:3001'}/v1/${path.join('/')}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  const data = await upstream.json()
  return NextResponse.json(data, { status: upstream.status })
}
```

### TanStack Query v5 Patterns (BREAKING CHANGES from v4)

```typescript
// Providers wrapper (MUST be 'use client')
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,  // was cacheTime in v4 — renamed!
      },
    },
  }))
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

```typescript
// useQuery v5 — object syntax ONLY (positional args removed)
const { data, isPending, isError } = useQuery({
  queryKey: ['users'],           // array key
  queryFn: () => fetch('/api/v1/users').then(r => r.json()),
  enabled: !!orgId,
})
// isPending (not isLoading), gcTime (not cacheTime)

// useMutation v5
const mutation = useMutation({
  mutationFn: ({ id, role }: { id: string; role: string }) =>
    fetch(`/api/v1/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    }).then(r => r.json()),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
})
```

### Zustand v5 Store Pattern

```typescript
// apps/web/src/store/ui.ts
import { create } from 'zustand'

interface UIStore {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}))
```

### Fastify `GET /v1/me` Implementation

```typescript
// New in apps/api/src/routes/users.ts
fastify.get('/v1/me', {
  preHandler: [authenticate, tenantMiddleware],
}, async (request) => {
  return {
    userId: request.user.userId,
    orgId: request.user.orgId,
    role: request.user.role,
    tier: request.tenant.tier,
  }
})
```

### Fastify `GET /v1/users` Implementation

Returns paginated users with their roles. The users and role_assignments tables are in the tenant schema.

```typescript
fastify.get('/v1/users', {
  preHandler: [authenticate, tenantMiddleware, requireRole('OrgAdmin')],
}, async (request) => {
  const schema = request.tenant.schemaName
  const users = await prisma.$queryRawUnsafe<Array<{
    id: string; email: string; name: string; active: boolean; role: string | null
  }>>(
    `SELECT u.id, u.email, u.name, u.active, ra.role
     FROM "${schema}".users u
     LEFT JOIN "${schema}".role_assignments ra
       ON ra.user_id = u.id AND ra.business_unit_id IS NULL
     ORDER BY u.name ASC`,
  )
  return { data: users }
})
```

### Fastify `PATCH /v1/users/:id` Implementation

```typescript
fastify.patch('/v1/users/:id', {
  preHandler: [authenticate, tenantMiddleware, requireRole('OrgAdmin')],
}, async (request) => {
  const { id } = (request as FastifyRequest<{ Params: { id: string } }>).params
  const { role } = (request as FastifyRequest<{ Body: { role: string } }>).body
  const schema = request.tenant.schemaName
  const tenantId = request.tenant.tenantId

  await prisma.$executeRawUnsafe(
    `INSERT INTO "${schema}".role_assignments (user_id, role)
     VALUES ($1, $2)
     ON CONFLICT (user_id) WHERE business_unit_id IS NULL
     DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`,
    id, role
  )
  // Flush Redis RBAC cache
  await redis.del(`rbac:${tenantId}:${id}`)

  return { data: { userId: id, role } }
})
```

### Sidebar Role → Nav Item Mapping

```typescript
const NAV_ITEMS: Record<string, NavItem[]> = {
  OrgAdmin: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/controls', label: 'Controls', icon: 'Shield' },
    { href: '/evidence', label: 'Evidence', icon: 'FileCheck' },
    { href: '/audits', label: 'Audits', icon: 'ClipboardList' },
    { href: '/risk', label: 'Risk', icon: 'AlertTriangle' },
    { href: '/integrations', label: 'Integrations', icon: 'Plug' },
    { href: '/reports', label: 'Reports', icon: 'BarChart3' },
    { href: '/settings/team', label: 'Settings', icon: 'Settings' },
  ],
  AuditDirector: [/* same as OrgAdmin minus settings */],
  ControlOwner: [
    { href: '/my-tasks', label: 'My Tasks', icon: 'CheckSquare' },
    { href: '/controls', label: 'Controls', icon: 'Shield' },
    { href: '/evidence', label: 'Evidence', icon: 'FileCheck' },
  ],
  Developer: [
    { href: '/developer', label: 'Developer Portal', icon: 'Code' },
  ],
  ReadOnly: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/controls', label: 'Controls', icon: 'Shield' },
  ],
}
```

### Root Page Role-Based Redirect Logic

```typescript
// apps/web/src/app/page.tsx (Server Component)
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

const ROLE_ROUTES: Record<string, string> = {
  OrgAdmin: '/dashboard',
  AuditDirector: '/dashboard',
  ControlOwner: '/my-tasks',
  Developer: '/developer',
  ReadOnly: '/dashboard',
  BoardExecutive: '/dashboard',
  ExternalAuditor: '/dashboard',
}

export default async function HomePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Fetch role from BFF (server-to-server, same process)
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  
  try {
    const res = await fetch(`${protocol}://${host}/api/v1/me`, {
      headers: { cookie: headersList.get('cookie') ?? '' },
      cache: 'no-store',
    })
    if (res.ok) {
      const { role } = await res.json()
      redirect(ROLE_ROUTES[role] ?? '/dashboard')
    }
  } catch {
    // If BFF call fails (e.g. not yet provisioned), redirect to dashboard
  }
  
  redirect('/dashboard')
}
```

### Sign-in / Sign-up Pages (Clerk hosted UI)

```typescript
// apps/web/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <SignIn />
    </div>
  )
}

// apps/web/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <SignUp />
    </div>
  )
}
```

### CSS Grid Shell Layout

```typescript
// apps/web/src/app/(app)/layout.tsx
// Three-column grid — sidebar | content | right panel
// Tailwind classes for the grid:
//   xl: grid-cols-[240px_1fr_280px]  (≥1280px)
//   lg: grid-cols-[56px_1fr]         (1024–1279px, collapsed sidebar)
//   default: grid-cols-[1fr]          (<1024px, sidebar overlay)
```

### Story 1.3 Learnings Applied

- `vi.resetAllMocks()` clears factory-set mock return values — re-apply mocks inside `beforeEach` after reset
- Missing env vars in test env cause 500s — always set test env vars in `beforeEach`
- TypeScript generic `FastifyRequest<{ Params: ... }>` not assignable to `RouteHandlerMethod` — cast inside handler body instead
- `fastify-raw-body` needed upgrading to v5 — always verify peer dependency versions match project's major version
- Test env var pattern: `process.env["VAR_NAME"] = "test_value"` in `beforeEach`

### Story 1.2 Learnings Applied

- ESLint 9 flat config is in root `eslint.config.mjs` — do not add rules elsewhere
- TypeScript declaration merging for Fastify: `declare module "fastify" { interface FastifyRequest { ... } }` pattern
- `prisma.$queryRawUnsafe` (not `$queryRaw`) for parameterized tenant schema queries
- `packages/db/.env` must exist with `DATABASE_URL` for Prisma CLI

### File Structure for This Story

**New files:**
```
apps/web/src/middleware.ts
apps/web/src/app/layout.tsx                         (UPDATE)
apps/web/src/app/page.tsx                           (UPDATE)
apps/web/src/app/providers.tsx                      (NEW)
apps/web/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx  (NEW)
apps/web/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx  (NEW)
apps/web/src/app/(app)/layout.tsx                   (NEW)
apps/web/src/app/(app)/dashboard/page.tsx           (NEW)
apps/web/src/app/(app)/my-tasks/page.tsx            (NEW)
apps/web/src/app/(app)/developer/page.tsx           (NEW)
apps/web/src/app/(app)/settings/team/page.tsx       (NEW)
apps/web/src/app/api/v1/[...path]/route.ts          (NEW)
apps/web/src/components/layout/Sidebar.tsx          (NEW)
apps/web/src/components/layout/TopNav.tsx           (NEW)
apps/web/src/components/layout/index.ts             (NEW)
apps/web/src/store/ui.ts                            (NEW)
apps/web/src/features/auth/hooks.ts                 (NEW)
apps/web/src/features/auth/queries.ts               (NEW)
apps/web/src/features/auth/index.ts                 (NEW)
apps/api/src/routes/users.ts                        (UPDATE — add GET /me, GET /users, PATCH /users/:id)
apps/api/src/routes/users.test.ts                   (UPDATE — add tests for new endpoints)
apps/web/package.json                              (UPDATE — add clerk, query, zustand, lucide-react)
```

### Environment Variables Required

All already in `.env.example`:
```bash
# For apps/web (Next.js)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
INTERNAL_API_URL=http://localhost:3001
API_SERVICE_ACCOUNT_TOKEN=  # empty in dev — Clerk token forwarded instead

# For apps/api (Fastify — already set in Story 1.3)
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_KEY=...
```

### Testing Approach

Story 1.4 is primarily a frontend story. Backend tests (new Fastify endpoints) use vitest with the same patterns from Story 1.3:
- Mock `@grc/db` prisma
- Mock `@clerk/fastify` getAuth
- Mock `../plugins/redis.js`
- Set env vars in `beforeEach`

Frontend testing is deferred to Story 1.6 (CI/CD + observability + regression tests). For Story 1.4: **run `pnpm --filter @grc/web build` as the acceptance gate for the UI** — a successful production build confirms the type-safety and structural correctness of all server components, client components, and route handlers.

### References

- Architecture: Frontend Architecture — `architecture.md#Frontend Architecture`
- Architecture: BFF Communication — `architecture.md#BFF Communication`
- Architecture: State Management — `architecture.md#State Management`
- Architecture: Directory structure — `architecture.md` lines 476–532
- UX: App shell layout — `ux-design-specification.md` lines 673–729
- UX: Sidebar specs — `ux-design-specification.md` lines 1228–1244
- Clerk v7 docs: `@clerk/nextjs` middleware, `auth()`, `ClerkProvider`
- TanStack Query v5 migration: `gcTime` (was `cacheTime`), `isPending` (was `isLoading`), object-only query API

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log

- `UserButton afterSignOutUrl` prop removed — not valid in `@clerk/nextjs` v7 / `@clerk/react` v6. Moved `afterSignOutUrl="/sign-in"` to `ClerkProvider` in root layout instead.

### Completion Notes List

- Tasks 1–12 all complete. All 12 tasks implemented in a single session.
- 32 Fastify API tests pass (5 new for GET /me, GET /users, PATCH /users/:id + 3 existing DELETE).
- Next.js production build succeeds: 9 routes compiled with 0 TS errors and 0 lint errors.
- BFF proxy forwards Clerk session JWT (via `getToken()`) — Fastify's existing `clerkPlugin` verifies it unchanged.
- UserTable disables Deactivate for self (uses `useUser()` from Clerk to get current user ID).
- `afterSignOutUrl` is a `ClerkProvider` prop in v7, not a `UserButton` prop — fixed during verification.

### File List

- `apps/web/package.json` — UPDATED (added @clerk/nextjs, @tanstack/react-query, zustand, lucide-react)
- `apps/web/src/middleware.ts` — NEW
- `apps/web/src/app/layout.tsx` — UPDATED (ClerkProvider + afterSignOutUrl)
- `apps/web/src/app/page.tsx` — UPDATED (role-based redirect)
- `apps/web/src/app/providers.tsx` — NEW
- `apps/web/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` — NEW
- `apps/web/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` — NEW
- `apps/web/src/app/(app)/layout.tsx` — NEW
- `apps/web/src/app/(app)/dashboard/page.tsx` — NEW
- `apps/web/src/app/(app)/my-tasks/page.tsx` — NEW
- `apps/web/src/app/(app)/developer/page.tsx` — NEW
- `apps/web/src/app/(app)/settings/team/page.tsx` — NEW
- `apps/web/src/app/(app)/settings/team/UserTable.tsx` — NEW
- `apps/web/src/app/api/v1/[...path]/route.ts` — NEW
- `apps/web/src/components/layout/Sidebar.tsx` — NEW
- `apps/web/src/components/layout/TopNav.tsx` — NEW
- `apps/web/src/components/layout/index.ts` — NEW
- `apps/web/src/store/ui.ts` — NEW
- `apps/web/src/features/auth/hooks.ts` — NEW
- `apps/web/src/features/auth/queries.ts` — NEW
- `apps/web/src/features/auth/index.ts` — NEW
- `apps/api/src/routes/users.ts` — UPDATED (GET /me, GET /users, PATCH /users/:id)
- `apps/api/src/routes/users.test.ts` — UPDATED (8 tests total)
- `.env.example` — UPDATED (Clerk Next.js env vars)

### Change Log

- 2026-05-04: Story 1.4 fully implemented — all 12 tasks complete, all ACs satisfied. `pnpm --filter @grc/web build` clean, 32 API tests pass.
