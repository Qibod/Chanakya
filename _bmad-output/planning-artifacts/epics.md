---
stepsCompleted: ['step-01-extract-requirements', 'step-01-confirmed', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# GRC - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for GRC, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Onboarding & Company Intelligence**
- FR1: New users can initiate AI-powered company fingerprinting by entering a company name to auto-populate industry classification, org structure, business processes, risk domains, and regulatory obligations
- FR2: Users can review AI-inferred company data with confidence indicators (High / Medium / Low) and source attribution per data point before committing it to the system
- FR3: Users can override, edit, or exclude any AI-inferred data point before it enters the control framework
- FR4: Users can complete initial platform setup through a guided onboarding checklist with progress tracking and contextual in-app help
- FR5: Starter tier users can view a read-only gap assessment and estimated control count for frameworks not included in their active subscription

**Compliance & Control Management**
- FR6: Users can activate and configure compliance frameworks from the library: SOC 2, ISO 27001, SOX, GDPR, NIST CSF
- FR7: The system can automatically map controls across multiple active frameworks, surfacing shared controls to eliminate duplication
- FR8: Audit Directors can assign controls to specific control owners with AI-generated, integration-aware task instructions
- FR9: The system can automatically generate and update context-aware task instructions for each control assignment based on the organisation's connected integrations
- FR10: Users can view a real-time compliance dashboard showing control health status (green / amber / red) across all active frameworks
- FR11: Users can track gap remediation progress and framework completion percentage at any time
- FR12: Audit Directors can create and manage audit engagements with defined scope, timeline, assigned controls, and sign-off requirements

**Evidence Management**
- FR13: The system can automatically and continuously collect evidence from connected integrations
- FR14: Users can manually upload evidence files to specific controls
- FR15: The system preserves evidence immutability with cryptographic integrity verification on ingest and export
- FR16: Users can view version history for each control's evidence, with a single canonical "current" evidence designation per control
- FR17: Auditors and control owners can communicate through a per-control threaded conversation with comment, response, re-upload, and resolution states
- FR18: Users can view the source system and last-synced timestamp for every piece of collected evidence
- FR19: The system automatically degrades control health status when evidence becomes stale or integration connectivity fails

**Integration & Connectivity**
- FR20: Users can connect and configure native integrations (Okta, AWS, Salesforce, Jira) through a no-code configuration interface
- FR21: Users can view real-time integration health status (connected / degraded / failed) for all connected systems
- FR22: Admins and control owners receive notifications when integration failures are detected within platform SLA windows
- FR23: Developers can ingest evidence from any system via REST API with structured payload schema and webhook endpoints
- FR24: Developers can test integrations against an isolated sandbox environment that does not affect production audit records
- FR25: Admins can configure evidence polling intervals for integrations that do not support event-driven connectivity

**Audit Management & Reporting**
- FR26: Audit Directors can generate board-ready audit reports from completed audit workpapers in a single action
- FR27: Users can export audit reports as PDF and interactive HTML, both including chain-of-custody metadata
- FR28: Users can track open findings across audit cycles with owner, status, due date, and resolution history
- FR29: Audit Directors can require explicit scope sign-off confirmation before an audit is opened
- FR30: (Growth) Audit Directors can issue time-limited, scoped access tokens to external auditors for a specific audit's evidence room
- FR31: (Growth) External auditors can review evidence, flag insufficiencies, and leave inline comments within their scoped evidence room
- FR32: (Growth) Audit Directors can revoke external auditor access tokens at any time
- FR33: (Growth) Users can query audit status, draft findings, and surface evidence anomalies through a conversational AI co-pilot
- FR53: (Growth) Users can invoke contextual AI assistance inline on any control, risk, or evidence item without leaving the current view

**Risk & Regulatory Intelligence**
- FR34: Users can view a compliance trajectory score reflecting overall control health as a rolling indicator over time
- FR35: Users receive automated periodic compliance digest summaries surfacing health changes and upcoming obligations
- FR36: Users receive alerts when monitored regulatory bodies publish changes relevant to their active compliance frameworks
- FR37: Users can view a risk register with risks mapped to controls, owners, likelihood, impact, and remediation status
- FR38: (Growth) The system monitors external signals (news, regulatory updates, vendor breach alerts) and maps them to the user's active control framework in real time
- FR39: (Growth) An AI regulatory change agent assesses the impact of a detected regulatory change on the user's control framework and drafts a remediation action plan

**User & Access Management**
- FR40: Organisation Admins can create, modify, and deactivate user accounts with role assignments
- FR41: Control owners can receive task notifications through configurable channels including email and messaging integrations
- FR42: (Growth+) Users can authenticate via SSO using SAML 2.0 or OIDC identity providers
- FR43: (Growth+) Admins can configure automated user provisioning and deprovisioning via SCIM
- FR44: (Growth+) Admins can configure group-to-role mapping rules that automatically assign platform roles based on identity provider group membership
- FR45: (Growth+) Board members and executives can access a read-only compliance status view via magic link or SSO without operational platform access

**Platform Administration & Developer Tools**
- FR46: Organisation Admins can manage subscription tier, billing preferences, and view current usage against tier limits
- FR47: Admins can export all tenant data (controls, evidence, audit history, reports) in full at any time
- FR48: (Scale) Admins can select data residency region at tenant provisioning
- FR49: (Growth) Scale tier admins can configure independent framework settings and user pools for multiple business units within a single tenant
- FR50: Developers can manage API keys, webhook endpoints, and sandbox credentials through a developer portal
- FR51: Platform operators can access tamper-evident audit logs of all platform actions with actor, timestamp, and resource
- FR52: (Vision) Users can scrub through historical control environment states and run AI-powered counterfactual scenario simulations

### NonFunctional Requirements

**Performance**
- NFR1: Dashboard and control health views render within 2 seconds under normal load (≤500 concurrent users per tenant)
- NFR2: Evidence collected from integrations reflected in control health within 5 minutes of webhook event; within 8 hours of scheduled poll cycle
- NFR3: Audit report generation completes within 60 seconds for audits with up to 500 evidence items
- NFR4: REST API endpoints respond within 500ms at the 95th percentile under normal load
- NFR5: AI co-pilot synchronous query responses return within 5 seconds at the 95th percentile
- NFR6: Async AI jobs surface completion notification within 30 seconds of job completion
- NFR7: Platform onboarding fingerprinting completes within 90 seconds of company name submission

**Security**
- NFR8: All data encrypted at rest using AES-256; all data in transit using TLS 1.3 minimum
- NFR9: Scale tier customers can supply their own encryption keys (BYOK) for data at rest
- NFR10: Evidence files stored in write-once object storage with SHA-256 integrity hash; hash verified on every export
- NFR11: Third-party penetration test completed before general availability covering cross-tenant isolation, RBAC bypass, evidence tampering, external auditor token enumeration, and API credential abuse
- NFR12: Automated cross-tenant isolation regression tests run on every production deployment; any failure blocks deployment
- NFR13: Integration credentials stored in secrets manager (not application database); encrypted with tenant-specific keys
- NFR14: Session tokens invalidated immediately on user deactivation or SCIM deprovisioning event
- NFR15: External auditor access tokens are time-limited (default 30 days), scoped to specific audit IDs (UUID, non-enumerable), revocable on demand
- NFR16: All platform actions written to tamper-evident audit log with actor, timestamp, IP, and resource
- NFR17: Platform achieves and maintains SOC 2 Type II certification; initiated at build start, completed before mid-market GTM launch

**Scalability**
- NFR18: Platform architecture supports 1,000 concurrent tenants without degradation at MVP; designed to scale to 10,000 tenants without schema changes
- NFR19: Single tenant supports up to 500 concurrent users without performance degradation below stated thresholds
- NFR20: Evidence storage scales to 10TB per tenant without architectural changes
- NFR21: Integration polling infrastructure handles 100,000 evidence ingestion events per hour across all tenants
- NFR22: AI inference pipeline scales horizontally; no single-tenant job blocks or degrades processing for other tenants

**Reliability**
- NFR23: Platform uptime SLA: 99.5% for Starter; 99.9% for Growth and Scale (measured monthly, excluding scheduled maintenance)
- NFR24: Recovery Time Objective (RTO): 4 hours for Starter; 1 hour for Growth and Scale
- NFR25: Recovery Point Objective (RPO): 24 hours for Starter; 1 hour for Growth and Scale
- NFR26: Evidence pipeline maintains 99.9% delivery reliability; failed ingestion events retried with dead-letter queue and alerting
- NFR27: Integration failure detected within 1 hour; customer notified within 4 hours
- NFR28: Automated database backups every 6 hours; retained for 30 days; evidence object storage versioning enabled
- NFR29: Zero-downtime deployments required for all production releases

**Accessibility**
- NFR30: All user-facing interfaces comply with WCAG 2.1 Level AA
- NFR31: All interactive elements operable via keyboard navigation
- NFR32: Screen reader compatibility for core workflows: compliance dashboard, control assignment, evidence upload, and report generation
- NFR33: Colour is never the sole means of conveying control health status — communicated through labels, icons, or text in addition to colour
- NFR34: Canvas-based features (Growth/Vision) provide an accessible 2D fallback meeting WCAG 2.1 AA for all core operations

**Data & Compliance**
- NFR35: Customer data retained for subscription duration plus 30 days post-cancellation; purged within 30 days of contract end
- NFR36: SOX evidence retained minimum 7 years per customer configuration; GDPR erasure conflicts with SOX retention surfaced explicitly for customer policy decision
- NFR37: EU tenant data stored and processed exclusively within EU regions; no cross-region transfer without explicit customer consent
- NFR38: Data minimisation applied to all AI inference inputs; platform processes no data beyond what is necessary for compliance monitoring

### Additional Requirements

Architecture-driven requirements that affect implementation sequencing and story scope:

- **ARCH-1 — Starter Template**: First story must be `npx create-turbo@latest grc --package-manager pnpm`; initialises Turborepo monorepo with `apps/web`, `apps/api`, `apps/worker`, `packages/db`, `packages/types`, `packages/ai`, `packages/ui`, `packages/config`
- **ARCH-2 — Schema-per-tenant**: Prisma Client Extensions with dynamic `search_path` injection per request; tenant ID from request context only (never client-supplied headers); tenant schema provisioned on creation via Prisma Migrate
- **ARCH-3 — First migration**: `platform_audit_logs` table in public schema — append-only (`INSERT` only, no `UPDATE`/`DELETE` grants); columns: `(id, tenant_id, actor_id, action, resource_type, resource_id, ip_address, occurred_at)` — must be created before any tenant schemas
- **ARCH-4 — control_health_snapshots**: Append-only table for GRC time machine data model (Vision); data collection must start from day one even though the UI ships in Phase 3
- **ARCH-5 — business_units table**: Nullable `business_unit_id` column on all BU-scoped tables from day one; single-BU tenants use `null`; multi-BU UI ships in Phase 2
- **ARCH-6 — Clerk authentication**: Primary auth provider handling user sign-up/in, session management, magic links, SAML 2.0 + OIDC SSO (Growth+), SCIM 2.0 (Growth+); Clerk webhook → Fastify endpoint syncs local `users` + `role_assignments` tables on every Clerk event
- **ARCH-7 — External auditor tokens**: Custom UUID v7 token model (not Clerk sessions); `audit_access_tokens` table with `(id, audit_id, scoped_control_ids[], created_by, expires_at, revoked_at, last_used_at)`; Redis cache for revocation with 60s TTL
- **ARCH-8 — LLM provider**: Anthropic Claude via GCP Vertex AI; `claude-sonnet-4-6` for synchronous (co-pilot, inline AI, task instructions); `claude-opus-4-7` for async (report generation, fingerprinting, regulatory assessment); all calls through `packages/ai` with injection guard and metadata-only evidence handling
- **ARCH-9 — Real-time updates (SSE)**: Fastify `/v1/tenants/:tenantId/stream` SSE endpoint; control health events via Redis pub/sub; WebSocket upgrade deferred to Growth canvas collaboration
- **ARCH-10 — Infrastructure baseline**: GCP Cloud SQL (PostgreSQL), GCP Cloud Storage (Object Retention Lock), GCP Cloud Tasks (job queue), GCP Cloud Run (API + workers), GCP Memorystore (Redis), GCP Secret Manager; Vercel for Next.js frontend; Terraform in `infra/`
- **ARCH-11 — CI/CD**: GitHub Actions for GCP deploys; Vercel native for `apps/web`; Turbo remote cache via Vercel; cross-tenant isolation regression tests must block every deployment
- **ARCH-12 — EU data residency**: Terraform region configuration must be designed from day one even if the tenant-selection UI ships in Phase 2
- **ARCH-13 — Pre-GA penetration test**: Third-party pen test must cover cross-tenant data isolation, RBAC privilege escalation, evidence tampering, external auditor token enumeration, and API credential abuse — required before general availability

### UX Design Requirements

Requirements extracted from the UX Design Specification that are directly actionable as implementation work:

- **UX-DR1 — Design token system**: Semantic CSS custom properties defined in `packages/ui/tokens/` with full dark/light mode — all 15 dark-mode tokens (`--surface-base` through `--status-fail-bg`) and corresponding light-mode values; authenticated app defaults to dark mode; all components reference semantic tokens exclusively, never primitive values
- **UX-DR2 — Typography system**: Inter (primary) and Geist Mono loaded via `next/font`; nine-step type scale from `display` (32px/700) to `caption-sm` (11px/400); `font-variant-numeric: tabular-nums` applied globally to all numeric data; three active hierarchy levels maximum per view
- **UX-DR3 — StatusChip component**: Five variants (pass/warn/fail/auto/pending); three sizes (sm/md/lg); icon + colour + text label always rendered together; `compact` mode icon-only with tooltip; `role="status"`, `aria-label` on all instances
- **UX-DR4 — ConfidenceChip component**: Three confidence tiers (high ≥80% / medium 50–79% / low <50%); source popover on hover/focus; one-time first-hover tooltip per session; `aria-label="AI confidence: X%. Click to see sources."`
- **UX-DR5 — StreamingText component**: Fingerprinting stream animation — 40ms stagger per line, `opacity 0→1` + `translateY(4px→0)` transitions; inline override Input (no modal); four-phase progress arc; `aria-live="polite"` region; `prefers-reduced-motion` renders all lines instantly
- **UX-DR6 — ECGPulse sparkline**: SVG `<polyline>`, no axes, thin stroke; 30 daily pass-rate values pre-computed server-side; hover triggers stroke-dashoffset trace animation (600ms); `aria-hidden="true"`; trend described in parent card `aria-label`
- **UX-DR7 — ControlCard component**: Five anatomy elements (domain name, pass rate %, ECGPulse, StatusChip + FrameworkBadge, inline action for amber/red only); four states (passing/attention/failing/loading as skeleton); full card clickable; no navigation on inline actions
- **UX-DR8 — HealthSummaryBar component**: Four-metric row (passing count + delta, attention count, failing count, trajectory score + quarterly change); counts update via SSE push without full re-render; delta colour-coded (green = improvement, red = regression)
- **UX-DR9 — ActivityFeedItem component**: Severity-ranked action feed; fail items expanded by default with action buttons; warn items expanded; info/pass collapsed; action buttons fire handlers, no navigation
- **UX-DR10 — SidePanel component**: Fixed 400px width, full viewport height; `transform: translateX(100%→0)` 200ms ease-out; subtle backdrop (not full modal dark); focus trap; `role="dialog"`, `aria-label`; Escape closes; renders as shadcn Sheet below 768px; focus returns to trigger on close
- **UX-DR11 — ActionSpotlight component**: D4 Clarity First hero card; three variants (urgent/amber, normal/indigo, complete/green); inline "Why is this needed?" expander with AI plain-English context; zero compliance codes in this component
- **UX-DR12 — EvidenceRow component**: Seven anatomy elements (file type icon, file name, source chip, timestamp, hash indicator, StatusChip, action menu); four states (current/archived/flagged/pending); SHA-256 hash tooltip on hover
- **UX-DR13 — FrameworkBadge component**: Fixed colour per framework (SOC 2=indigo, ISO 27001=blue, GDPR=violet, NIST CSF=teal, SOX=amber); three sizes (sm/md/lg)
- **UX-DR14 — D1+D2 Combined Shell**: Three-column CSS grid (`240px / 1fr / 280px`); domain grid `repeat(4,1fr)` at ≥1280px, `repeat(3,1fr)` at 1024–1279px, `repeat(2,1fr)` at 768–1023px; sidebar collapses to 56px icon-only; role-based routing (Org Admin/Audit Director → `/dashboard`, Control Owner → `/my-tasks`, External Auditor → `/audit/:token`, Board → `/board/:token`, Developer → `/developer`)
- **UX-DR15 — Command palette (⌘K)**: Universal search across controls, evidence, audits, team, integrations, docs; keyboard-first (arrow keys + Enter + Escape); grouped results by type; recent searches when input empty; `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`
- **UX-DR16 — Responsive design implementation**: Three breakpoints (xl: full 3-col, md: condensed sidebar + hidden right panel, base: sidebar hidden); Board Portal fully responsive to 375px (single-column D6 view); SidePanel becomes Sheet below 768px; `rem` for typography and spacing, `px` for borders and fixed widths only
- **UX-DR17 — Accessibility implementation**: Skip link as first DOM element on every page; `aria-live="polite"` on HealthSummaryBar; `axe-core` via CI pipeline blocks merge on violations; all four primary flows navigable keyboard-only; screen reader testing quarterly with VoiceOver (macOS) + NVDA (Windows)
- **UX-DR18 — Fingerprinting onboarding flow**: Single-field screen at `/onboarding/fingerprint`; autofocus on mount; stream begins on Enter/click with no loading spinner; four phases (industry → obligations → controls → integrations); inline override without modal; "Looks right — let's continue" full-width CTA on stream complete
- **UX-DR19 — Control owner D4 Clarity First view**: Dedicated `/my-tasks` route for Control Owner role; hero card showing task count and "automated controls" count; ActionSpotlight cards per assigned task; never exposes D1+D2 shell to this role
- **UX-DR20 — Phase 2 custom components** (Growth): `ReportAssemblyProgress` (SVG arc driven by SSE job progress events; section labels stream in; `prefers-reduced-motion` → static progress bar); `BoardScoreRing` (100×100px SVG ring, arc colour by score threshold); `ControlNode`, `RiskEdge`, `DomainGroup` (React Flow v12 canvas components in `packages/ui/canvas/`, loaded via `next/dynamic` with `ssr: false`)

### FR Coverage Map

| FR | Epic | Domain |
|---|---|---|
| FR1 | Epic 2 | AI fingerprinting initiation |
| FR2 | Epic 2 | Confidence indicators & source attribution |
| FR3 | Epic 2 | Override/edit AI-inferred data |
| FR4 | Epic 2 | Guided onboarding checklist |
| FR5 | Epic 2 | Starter framework preview (read-only) |
| FR6 | Epic 2 | Framework library activation |
| FR7 | Epic 2 | Cross-framework control mapping |
| FR8 | Epic 3 | Control assignment with AI instructions |
| FR9 | Epic 3 | Dynamic context-aware task instructions |
| FR10 | Epic 3 | Real-time compliance dashboard |
| FR11 | Epic 3 | Gap remediation tracking |
| FR12 | Epic 5 | Audit engagement creation & management |
| FR13 | Epic 4 | Automated continuous evidence collection |
| FR14 | Epic 4 | Manual evidence upload |
| FR15 | Epic 4 | Evidence immutability & SHA-256 integrity |
| FR16 | Epic 4 | Evidence version history |
| FR17 | Epic 4 | Per-control conversation threads |
| FR18 | Epic 4 | Evidence source & last-synced timestamp |
| FR19 | Epic 4 | Automatic control health degradation |
| FR20 | Epic 4 | Native integration setup (Okta/AWS/Salesforce/Jira) |
| FR21 | Epic 4 | Integration health dashboard |
| FR22 | Epic 4 | Integration failure notifications |
| FR23 | Epic 4 | REST API evidence ingestion + webhooks |
| FR24 | Epic 4 | Sandbox environment |
| FR25 | Epic 4 | Polling interval configuration |
| FR26 | Epic 5 | Board-ready audit report generation |
| FR27 | Epic 5 | PDF + interactive HTML export |
| FR28 | Epic 5 | Open findings tracking |
| FR29 | Epic 5 | Scope sign-off pre-audit checklist |
| FR30 | Epic 8 | External auditor access token issuance |
| FR31 | Epic 8 | External auditor evidence room & inline review |
| FR32 | Epic 8 | Token revocation |
| FR33 | Epic 9 | Conversational AI co-pilot |
| FR34 | Epic 6 | Compliance trajectory score |
| FR35 | Epic 6 | Automated compliance digest emails |
| FR36 | Epic 6 | Regulatory change alerts |
| FR37 | Epic 6 | Risk register |
| FR38 | Epic 10 | Ambient signal monitoring (Growth) |
| FR39 | Epic 10 | Regulatory change agent (Growth) |
| FR40 | Epic 1 | User account management |
| FR41 | Epic 4 | Control owner task notifications |
| FR42 | Epic 11 | SSO (SAML 2.0 / OIDC) |
| FR43 | Epic 11 | SCIM provisioning/deprovisioning |
| FR44 | Epic 11 | Group-to-role mapping |
| FR45 | Epic 11 | Board/executive portal |
| FR46 | Epic 7 | Subscription & billing management |
| FR47 | Epic 7 | Full tenant data export |
| FR48 | Epic 12 | Data residency selection (Scale) |
| FR49 | Epic 12 | Multi-BU configuration (Scale) |
| FR50 | Epic 7 | Developer portal (API keys, webhooks, sandbox) |
| FR51 | Epic 7 | Tamper-evident audit log access (table created Epic 1) |
| FR52 | Epic 14 | GRC Time Machine (Vision) |
| FR53 | Epic 9 | Inline AI assistance (Growth) |

## Epic List

### Epic 1: Platform Foundation, Auth & Design System
Engineers can run the full monorepo locally; the platform has working authentication (sign-up, login, role-based shell routing), RBAC enforcement on every API route, the full design token system (dark/light mode), shared component primitives, CI/CD deploying to staging, and the tamper-evident audit log table as the first database migration.
**FRs covered:** FR40, FR51 (table creation)
**ARCH covered:** ARCH-1 through ARCH-13
**UX covered:** UX-DR1, UX-DR2, UX-DR13, UX-DR14, UX-DR15, UX-DR16, UX-DR17

### Epic 2: AI-Native Onboarding & Compliance Framework Library
A new user can type their company name, watch the AI fingerprinting stream build their control framework in 90 seconds with confidence scores and source chips, review/override any item inline, activate frameworks from the library, and land on the compliance dashboard with a pre-populated unified control library showing cross-framework shared controls. Starter tier sees a read-only gap assessment for locked frameworks.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7
**UX covered:** UX-DR4, UX-DR5, UX-DR18

### Epic 3: Compliance Dashboard & Control Operations
Audit Directors see a live D1+D2 dashboard with ECG domain health cards and an action feed, can assign controls to owners with AI-generated integration-aware instructions, and track gap remediation. Control Owners land on a purpose-built plain-English `/my-tasks` view and can complete assigned tasks without training.
**FRs covered:** FR8, FR9, FR10, FR11
**UX covered:** UX-DR3, UX-DR6, UX-DR7, UX-DR8, UX-DR9, UX-DR10, UX-DR11, UX-DR19

### Epic 4: Evidence Collection, Integrations & Immutability
Evidence collects continuously from Okta, AWS, Salesforce, and Jira via webhooks-first connectivity with polling fallback; SHA-256 integrity is enforced on every ingest; control health degrades automatically on staleness or integration failure; version history and per-control conversation threads are available; Control Owners receive Slack/email notifications; developers can ingest custom evidence via REST API with a sandbox environment.
**FRs covered:** FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR41
**UX covered:** UX-DR12

### Epic 5: Audit Lifecycle & Board-Ready Reporting
Audit Directors can create formal audit engagements with defined scope, require explicit sign-off before opening, track open findings with owners and due dates across cycles, and generate a board-ready PDF + interactive HTML audit report in a single action in under 60 seconds.
**FRs covered:** FR12, FR26, FR27, FR28, FR29

### Epic 6: Risk Intelligence & Year-Round Engagement
The compliance trajectory score rolls as a continuous health indicator; users receive automated weekly compliance digest emails; real-time regulatory change alerts fire when GDPR/ISO/SOC 2/NIST updates are detected; a risk register maps risks to controls with owners, likelihood, impact, and remediation status — making GRC a year-round habit, not a seasonal panic.
**FRs covered:** FR34, FR35, FR36, FR37

### Epic 7: Platform Administration & Developer Portal
Org Admins manage subscription tier, billing preferences, and track usage against tier limits; full tenant data export is available at any time; developers manage API keys, webhook endpoints, and sandbox credentials through a developer portal; platform operators access the tamper-evident audit log UI.
**FRs covered:** FR46, FR47, FR50, FR51 (UI access)

### Epic 8: External Auditor Portal & Collaboration *(Growth)*
Audit Directors invite external auditors via time-limited scoped UUID tokens to a structured evidence room; auditors navigate by domain, download evidence packages, flag insufficiencies, and leave inline comments; Audit Directors see flags immediately; tokens are revocable at any time.
**FRs covered:** FR30, FR31, FR32

### Epic 9: AI Co-pilot & Inline Intelligence *(Growth)*
Users query audit status, draft findings, and surface evidence anomalies through a conversational AI co-pilot; all users invoke contextual AI assistance inline on any control, risk, or evidence item without leaving the current view; report generation shows the animated ReportAssemblyProgress sequence.
**FRs covered:** FR33, FR53
**UX covered:** UX-DR20 (ReportAssemblyProgress)

### Epic 10: Regulatory Intelligence Agents *(Growth)*
The platform continuously monitors external signals (news, regulatory updates, vendor breach alerts) mapped to active frameworks; an AI regulatory change agent assesses impact and drafts a remediation action plan.
**FRs covered:** FR38, FR39

### Epic 11: Enterprise Access Management *(Growth)*
Enterprise customers authenticate via SAML 2.0 or OIDC SSO; admins configure SCIM automated provisioning/deprovisioning with immediate session invalidation; group-to-role mapping rules automate role assignment from IdP groups; board members and executives access a read-only compliance summary via magic link or SSO.
**FRs covered:** FR42, FR43, FR44, FR45
**UX covered:** UX-DR20 (BoardScoreRing)

### Epic 12: Scale & Enterprise Administration *(Growth/Scale)*
Scale tier admins select EU data residency region at provisioning; Scale tier supports multiple independent business units with separate framework configs, user pools, and dashboards; Scale tier customers supply their own encryption keys (BYOK).
**FRs covered:** FR48, FR49
**NFRs covered:** NFR9 (BYOK)

### Epic 13: Living Control Canvas *(Growth)*
Growth tier users navigate a Figma-style infinite canvas showing control relationships with domain groupings, AI gap highlighting, and node-and-edge control mapping; a mandatory fully WCAG 2.1 AA compliant 2D list fallback is always available.
**FRs covered:** No standalone FR — surface is a Growth-tier UX capability; leverages control + risk data models from Epics 3, 4, 6
**ARCH covered:** ARCH-9 (WebSocket upgrade / canvas collaboration)
**NFRs covered:** NFR34 (canvas must have WCAG 2.1 AA fallback)
**UX covered:** UX-DR20 (ControlNode, RiskEdge, DomainGroup)

### Epic 14: GRC Time Machine *(Vision)*
Users scrub through historical control environment states (data collected from day one via ARCH-4 snapshots) and run AI-powered counterfactual scenario simulations — moving compliance from backward-looking documentation to forward-looking risk modelling.
**FRs covered:** FR52

---

## Epic 1: Platform Foundation, Auth & Design System

Engineers can run the full monorepo locally; the platform has working authentication (sign-up, login, role-based shell routing), RBAC enforcement on every API route, the full design token system (dark/light mode), shared component primitives, CI/CD deploying to staging, and the tamper-evident audit log table as the first database migration.

### Story 1.1: Monorepo Setup & GCP Infrastructure Bootstrap

As a developer on the GRC platform team,
I want a Turborepo monorepo initialised with all app and package stubs and GCP infrastructure provisioned,
So that the entire team has a consistent, runnable development environment from day one.

**Acceptance Criteria:**

**Given** the repository is cloned and `pnpm install` has been run
**When** a developer runs `pnpm dev`
**Then** `apps/web` (Next.js), `apps/api` (Fastify), and `apps/worker` all start locally without errors
**And** all package stubs (`packages/db`, `packages/types`, `packages/ai`, `packages/ui`, `packages/config`) are importable from the apps

**Given** the Terraform configuration in `infra/` is applied to the staging GCP project
**When** the apply completes
**Then** Cloud SQL (PostgreSQL), Cloud Run (API service + worker jobs), Cloud Tasks queue, Cloud Storage bucket with Object Retention Lock, Memorystore Redis, and Secret Manager are all provisioned
**And** the local Docker Compose file starts Cloud SQL Proxy + Redis container for local development

### Story 1.2: Database Foundation — Prisma Schema-per-Tenant & Platform Audit Log

As a platform developer,
I want a schema-per-tenant Prisma setup with the first database migration deployed,
So that tenant data isolation is enforced from the very first query and all platform actions are logged.

**Acceptance Criteria:**

**Given** a new tenant is provisioned
**When** the tenant provisioning function runs
**Then** a new PostgreSQL schema `tenant_{uuid}` is created with the Prisma template schema applied
**And** subsequent Prisma queries using that tenant's client context execute with `search_path = tenant_{uuid}, public`

**Given** any platform action occurs (user login, data change, API call)
**When** the action handler completes
**Then** a row is appended to the `platform_audit_logs` table in the public schema with `actor_id`, `action`, `resource_type`, `resource_id`, `ip_address`, and `occurred_at`
**And** the table has no `UPDATE` or `DELETE` grants — only `INSERT` and `SELECT` are permitted

**Given** a Fastify API handler attempts to resolve tenant from `request.params.tenantId` instead of `request.tenant`
**When** the middleware runs
**Then** the request is rejected with 400 and the pattern is flagged in a lint rule

**Given** a cross-tenant query is attempted (query in `tenant_A` schema referencing `tenant_B` data)
**When** the query executes
**Then** it returns zero results and does not leak tenant B data

**Given** the initial Prisma template schema is applied to a new tenant
**When** the schema migration runs
**Then** the `control_health_snapshots` append-only table is present with `(id, tenant_id, control_id, status, score, recorded_at)` columns (ARCH-4: data collection starts day one; Time Machine UI ships in Phase 3)
**And** all BU-scoped tables include a nullable `business_unit_id` column with no `NOT NULL` constraint (ARCH-5: single-BU tenants use `null`; multi-BU UI ships in Phase 2)

### Story 1.3: Clerk Authentication Integration & Core RBAC

As an authenticated user,
I want to sign up, log in, and have my role enforced on every API request,
So that the platform is secure and each user only accesses what their role permits.

**Acceptance Criteria:**

**Given** a new user visits the sign-up page
**When** they complete Clerk's hosted sign-up flow
**Then** a Clerk webhook fires and a local `users` row plus a `role_assignments` row (default role: `ControlOwner`) are created in the tenant schema
**And** the user's session is valid for subsequent API calls

**Given** a Fastify route is decorated with `requireRole('AuditDirector')`
**When** a user with role `ControlOwner` sends a request to that route
**Then** the API returns `403 Forbidden` with `{ error: { code: "FORBIDDEN", message: "..." } }`
**And** the check runs server-side; no role data is included in the response body

**Given** a Fastify route is decorated with `requireTier('growth')`
**When** a Starter tier tenant sends a request to that route
**Then** the API returns `402` with `{ error: { code: "TIER_LIMIT_EXCEEDED", message: "..." } }`

**Given** an Organisation Admin deactivates a user account
**When** the deactivation is processed
**Then** Clerk's API is called to invalidate all active sessions for that user
**And** the Redis session cache entry for that user is flushed immediately

**Given** a SCIM deprovisioning event arrives at the Clerk webhook endpoint
**When** the webhook is processed
**Then** the user's session is invalidated within 1 second of the event
**And** the local `users` record is marked inactive

### Story 1.4: Next.js App Shell, BFF Proxy & User Management

As an authenticated user,
I want to land on the correct view for my role and navigate the platform shell,
So that I only see what is relevant to my responsibilities from first login.

**Acceptance Criteria:**

**Given** an authenticated Audit Director navigates to the app root
**When** the shell renders
**Then** they are routed to `/dashboard` and see the sidebar with all navigation items for their role
**And** the sidebar is `240px` wide with icon + label, collapsible to `56px` icon-only on toggle

**Given** an authenticated Control Owner navigates to the app root
**When** the shell renders
**Then** they are routed to `/my-tasks` and see the D4 Clarity First view — not the full D1+D2 shell

**Given** an authenticated Developer/API User navigates to the app root
**When** the shell renders
**Then** they are routed to `/developer` with only developer-relevant navigation visible

**Given** the Next.js BFF API route receives a request requiring Fastify data
**When** the server-side component calls the BFF proxy
**Then** the request is forwarded to Fastify with `Authorization: Bearer {sa_token}` and the response is returned to the client without exposing Cloud Run credentials to the browser

**Given** an Organisation Admin navigates to Settings → Team
**When** the user management page loads
**Then** they can view all users, their current roles, and status (active/inactive)
**And** they can change a user's role from a dropdown and the change persists via `PATCH /v1/users/:id`
**And** they can deactivate a user which immediately invalidates their session

### Story 1.5: Design Token System & Shared Component Library Foundation

As a frontend developer building features,
I want a fully implemented design token system and shared component primitives available in `packages/ui`,
So that every feature is built on a consistent, accessible visual foundation with automatic dark/light mode.

**Acceptance Criteria:**

**Given** the authenticated app shell renders
**When** the page loads with no user preference set
**Then** the app renders in dark mode using the Slate Indigo palette (`--surface-base: #09090b`, `--accent: #6366f1`, etc.) as default
**And** switching to light mode via user settings updates all semantic tokens immediately with no component changes

**Given** any feature component is implemented in `apps/web`
**When** it references a colour value
**Then** it uses only semantic CSS custom properties (e.g. `var(--text-primary)`) — never primitive Tailwind values or hardcoded hex
**And** a custom ESLint rule (`no-primitive-colour`) flags any violation at build time

**Given** a developer imports `StatusChip`, `FrameworkBadge`, or `ConfidenceChip` from `packages/ui`
**When** they render the component
**Then** it renders correctly in both dark and light mode
**And** `axe-core` reports zero WCAG 2.1 AA violations for the component in Storybook

**Given** any page in the authenticated app shell loads
**When** it is inspected by a screen reader
**Then** the first DOM element is a skip link `<a href="#main-content">Skip to main content</a>` that is visible on focus
**And** the skip link is `sr-only` when not focused

**Given** the app shell renders on a 1440px viewport
**When** the three-column layout is active
**Then** the grid is `240px / 1fr / 280px` with `32px` gutters and `48px` horizontal page margin
**And** on 1024–1279px the sidebar collapses to 56px and the right panel hides with a toggle available

### Story 1.6: CI/CD Pipeline, Observability & Cross-Tenant Regression Tests

As a platform engineer,
I want a complete CI/CD pipeline with automated cross-tenant isolation tests blocking every deployment,
So that tenant data isolation is enforced continuously and no regression can reach production.

**Acceptance Criteria:**

**Given** a pull request is opened against `main`
**When** CI runs
**Then** `pnpm lint`, `pnpm test`, and `axe-core` accessibility checks all pass before the PR can be merged
**And** Turbo remote cache is used so unchanged packages are skipped

**Given** a commit is merged to `main`
**When** the deploy workflows run
**Then** `apps/web` is deployed to Vercel automatically
**And** `apps/api` and `apps/worker` are built, containerised, and deployed to Cloud Run via GitHub Actions
**And** Prisma migrations are applied before the Cloud Run service is updated (zero-downtime rolling deploy)

**Given** the cross-tenant isolation test suite runs as part of every production deployment
**When** any test verifies that a query in `tenant_A` cannot return data from `tenant_B`
**Then** all assertions pass before deployment proceeds
**And** any failure immediately halts the deployment pipeline and alerts on-call

**Given** an unhandled error occurs in `apps/web` or `apps/api`
**When** the error is raised
**Then** it is captured by Sentry with the full stack trace, tenant context, and user ID
**And** structured JSON logs are emitted to GCP Cloud Logging with `tenantId`, `requestId`, `actor`, and `severity` fields

---

## Epic 2: AI-Native Onboarding & Compliance Framework Library

A new user can type their company name, watch the AI fingerprinting stream build their control framework in 90 seconds with confidence scores and source chips, review/override any item inline, activate frameworks from the library, and land on the compliance dashboard with a pre-populated unified control library showing cross-framework shared controls. Starter tier sees a read-only gap assessment for locked frameworks.

### Story 2.1: AI Fingerprinting Pipeline — Backend Job & Claude Integration

As a new user completing onboarding,
I want the platform to infer my company's industry, regulatory obligations, and risk domains automatically from my company name,
So that I arrive at a pre-populated control framework without manual setup.

**Acceptance Criteria:**

**Given** a user submits their company name on the onboarding screen
**When** `POST /v1/fingerprint` is called
**Then** the API enqueues a `fingerprint` Cloud Tasks job and immediately returns `202 Accepted` with `{ jobId }`
**And** the worker picks up the job and calls Claude (`claude-opus-4-7` via Vertex AI) with only public company metadata — never raw files or PII

**Given** the fingerprinting worker completes analysis
**When** the job finishes
**Then** the result contains: industry classification, regulatory obligations, inferred org structure, business processes, and risk domains — each with a confidence tier (`high` ≥80%, `medium` 50–79%, `low` <50%) and source attribution (e.g. "LinkedIn", "SEC filings", "APQC")
**And** the result is stored in a `fingerprint_results` table in the tenant schema with status `pending_review` — nothing is committed to the control framework yet

**Given** the fingerprinting job completes
**When** the worker publishes the `fingerprint.completed` domain event
**Then** the SSE stream delivers the completion event to the client within 30 seconds
**And** the entire fingerprinting process from company name submission to SSE notification completes in under 90 seconds

**Given** the fingerprinting job fails (Claude timeout or source unavailable)
**When** the failure is detected
**Then** the job status is set to `failed` with a specific failure reason
**And** the onboarding screen falls back to the manual setup wizard with a clear explanation

### Story 2.2: Fingerprinting Stream UI — The Aha Moment

As a new user on the onboarding screen,
I want to watch the AI build my compliance framework live with confidence indicators,
So that I understand what has been inferred before committing it to my account.

**Acceptance Criteria:**

**Given** a user navigates to `/onboarding/fingerprint` after signup
**When** the page loads
**Then** a single autofocused input field is shown with placeholder "Type your company name…" and no other controls visible
**And** no loading spinner or progress bar is displayed before the user types

**Given** the user submits their company name and the fingerprinting stream begins
**When** results arrive via SSE
**Then** each result line fades in with `opacity: 0→1` and `translateY(4px→0)` at 40ms stagger intervals
**And** each line renders: `[phase chip] [content] [ConfidenceChip] [source chip] [Override link]`
**And** a four-phase progress arc in the top-right tracks progress through: industry → obligations → controls → integrations

**Given** the user hovers over a `ConfidenceChip` for the first time in the session
**When** the hover fires
**Then** a one-time tooltip appears: "AI confidence — click to see sources"
**And** clicking the chip opens a Popover listing the source citations for that inference

**Given** the user clicks "Override" on any streamed line
**When** the inline edit activates
**Then** an `Input` field appears in place — no modal, no page navigation
**And** the stream continues while the user edits
**And** `Enter` saves the override and marks that line with an "Edited" badge

**Given** the stream completes all four phases
**When** the last line appears
**Then** a full-width primary CTA button "Looks right — let's continue" appears below the stream
**And** a secondary link "Edit anything before proceeding" is available
**And** users with `prefers-reduced-motion` see all lines rendered instantly with no animation

### Story 2.3: Fingerprinting Review Confirmation & Framework Commit

As a new user who has reviewed the AI-inferred data,
I want to confirm or edit the fingerprint results before they enter my control framework,
So that no AI-inferred data is committed to the system without my explicit approval.

**Acceptance Criteria:**

**Given** the user clicks "Looks right — let's continue" on the fingerprinting screen
**When** the confirmation is processed
**Then** `POST /v1/fingerprint/:jobId/confirm` is called and the `fingerprint_results` status changes from `pending_review` to `committed`
**And** the committed data (industry, obligations, risk domains) is written to the tenant's framework configuration
**And** the user is routed to the integration setup screen

**Given** the user clicks "Edit anything before proceeding"
**When** the edit mode activates
**Then** all streamed lines become individually editable inline fields
**And** the user can remove any line entirely by clicking an × icon
**And** the CTA label changes to "Confirm my edits — let's continue"

**Given** a user submits the confirmation
**When** the commit is processed
**Then** a `fingerprint.confirmed` entry is written to `platform_audit_logs` with all confirmed data and any overrides applied
**And** the onboarding checklist advances to the next step (integration setup)

### Story 2.4: Compliance Framework Library & Control Activation

As a user completing onboarding,
I want to activate compliance frameworks and see a pre-populated unified control library,
So that I can start managing compliance without building my control set from scratch.

**Acceptance Criteria:**

**Given** the user reaches the framework selection step
**When** the framework library page loads
**Then** five frameworks are available: SOC 2, ISO 27001, SOX, GDPR, NIST CSF — each showing a description, control count, and recommended badge based on the fingerprint results
**And** frameworks recommended by the fingerprint are pre-selected with a "Recommended" badge

**Given** the user activates one or more frameworks
**When** activation is confirmed
**Then** the unified control library is populated with all controls for the selected frameworks
**And** controls shared across multiple active frameworks are surfaced once with all applicable `FrameworkBadge` tags — not duplicated
**And** the cross-framework overlap percentage is displayed ("68% of your controls are shared across your active frameworks")

**Given** a Starter tier user views the framework selection screen
**When** they see a framework not included in their tier
**Then** it is shown in a read-only locked state with a control count and "estimated X gaps" — driving Growth conversion without requiring a sales call
**And** clicking a locked framework shows a tier upgrade prompt, not a paywall block

**Given** framework activation is complete
**When** the user lands on the compliance dashboard for the first time
**Then** all activated controls are visible with status `pending` (no evidence yet collected)
**And** the onboarding checklist shows "Framework activated ✓" as a completed step

### Story 2.5: Onboarding Checklist & Contextual Help

As a new user setting up the platform,
I want a guided onboarding checklist that tracks my progress,
So that I always know what to do next and can pick up where I left off.

**Acceptance Criteria:**

**Given** a user has completed signup
**When** they enter the onboarding flow
**Then** an in-app checklist is visible showing steps: Company fingerprinting → Framework activation → Connect first integration → Assign first control → Generate first report
**And** each completed step is marked with a checkmark and the next step is highlighted

**Given** a user abandons onboarding mid-flow (closes the browser)
**When** they return and log back in
**Then** the checklist persists their progress and resumes from the last incomplete step
**And** the dashboard shows an onboarding progress banner ("3 of 5 setup steps complete") until all steps are done

**Given** a user hovers over or clicks a contextual help icon on any onboarding screen
**When** the help tooltip/popover opens
**Then** plain-English explanation of the current step is shown with a "Why this matters" one-liner
**And** no compliance jargon (e.g. "CC6.1", "Annex A") appears in the help text for onboarding screens

**Given** all five onboarding steps are completed
**When** the final step is marked done
**Then** the checklist collapses with a completion animation and the onboarding banner is dismissed permanently
**And** the full dashboard is presented without any onboarding overlays

### Story 2.6: Cross-Framework Control Mapping Engine

As an Audit Director managing multiple compliance frameworks,
I want the system to automatically surface controls shared across my active frameworks,
So that my team manages each control once instead of maintaining duplicate entries.

**Acceptance Criteria:**

**Given** two or more frameworks are active for a tenant
**When** the control library is viewed
**Then** controls that satisfy requirements in multiple frameworks are shown as a single unified control with a `FrameworkBadge` for each applicable framework
**And** a "Shared controls" counter on each framework view shows how many controls are reused

**Given** a control is shared across SOC 2 and ISO 27001
**When** an Audit Director views the control detail
**Then** the detail panel shows the specific requirement reference for each mapped framework (e.g. "SOC 2 CC6.1", "ISO 27001 A.9.2")
**And** evidence collected for this control satisfies both frameworks simultaneously — no duplicate upload needed

**Given** a new framework is activated on a tenant that already has active frameworks
**When** the new framework's controls are loaded
**Then** the cross-framework mapping engine runs automatically and surfaces newly shared controls
**And** the user sees a notification: "X controls from [new framework] are already covered by your existing controls"

---

## Epic 3: Compliance Dashboard & Control Operations

Audit Directors see a live D1+D2 dashboard with ECG domain health cards and an action feed, can assign controls to owners with AI-generated integration-aware instructions, and track gap remediation. Control Owners land on a purpose-built plain-English `/my-tasks` view and complete assigned tasks without training.

### Story 3.1: Control Library — List View, Status & Domain Organisation

As an Audit Director,
I want to view all controls organised by domain with live health status,
So that I can scan my compliance posture at a glance and know where to focus.

**Acceptance Criteria:**

**Given** an Audit Director navigates to `/controls`
**When** the control list loads
**Then** controls are grouped by domain with a collapsible section per domain
**And** each control row displays: control name, `FrameworkBadge`(s), `StatusChip` (pass/warn/fail/pending/auto), assigned owner avatar, and last-updated timestamp
**And** the list renders within 2 seconds under normal load (served from TanStack Query cache with stale-while-revalidate)

**Given** an Audit Director applies a filter (by framework, status, or owner)
**When** the filter chip is activated
**Then** the control list updates immediately using AND logic across active filters
**And** filter state persists within the session
**And** a "Clear all" link appears when any filter is active

**Given** an Audit Director clicks on a control row
**When** the selection fires
**Then** the `SidePanel` slides in from the right at `400px` width in 200ms
**And** the control list remains visible and scrollable behind the panel
**And** Escape closes the panel and returns focus to the triggering row

### Story 3.2: Real-Time Compliance Dashboard — D1+D2 Shell

As an Audit Director,
I want a live compliance dashboard that answers "are we on track?" without requiring any clicks,
So that I can complete my daily check-in in under 60 seconds.

**Acceptance Criteria:**

**Given** an Audit Director navigates to `/dashboard`
**When** the page loads
**Then** the `HealthSummaryBar` renders at the top with four metrics: passing count + weekly delta, attention count, failing count, and trajectory score placeholder
**And** data is served from Redis cache — no API call on navigation after the first load (stale-while-revalidate, 30s TTL)

**Given** the dashboard domain grid renders
**When** it is displayed on a ≥1280px viewport
**Then** eight `ControlCard` components are arranged in a `repeat(4, 1fr)` CSS grid
**And** each card shows: domain name, pass rate %, control count, `ECGPulse` sparkline (30-day history pre-computed server-side), `StatusChip`, and the top amber/red item with a specific inline action if any exist
**And** all-green domains display no inline action — the absence of action is the success state

**Given** a control health change event fires (via integration or manual update)
**When** the SSE stream pushes a `control.degraded` or `control.passed` event
**Then** the affected `ControlCard` re-renders with the new status within 5 seconds of the event
**And** the `HealthSummaryBar` counts update without a full page reload
**And** `aria-live="polite"` on the summary bar region announces the count change to screen readers

**Given** a domain card has a red (failing) control
**When** the card renders
**Then** the specific failing control name is surfaced inline with a "Fix now" button and an "Assign" button
**And** clicking "Fix now" opens the `SidePanel` for that control — no page navigation

**Given** the right panel action feed renders
**When** items are displayed
**Then** failing items are expanded by default with action buttons visible
**And** passing items are collapsed — ambient green signal only
**And** the feed polls every 30 seconds and also updates on SSE push events

### Story 3.3: Control Assignment & AI-Generated Task Instructions

As an Audit Director,
I want to assign controls to specific owners with AI-generated plain-English instructions tailored to our integrations,
So that control owners know exactly what to do without requiring training or follow-up questions.

**Acceptance Criteria:**

**Given** an Audit Director opens a control in the `SidePanel` and clicks "Assign"
**When** the assignment modal opens
**Then** they can select an owner from a list of platform users, set an optional due date, and review the AI-generated task instruction before saving
**And** the modal shows which integrations are connected and notes how the instruction has been tailored to them

**Given** the Audit Director confirms the assignment
**When** `POST /v1/controls/:id/assign` is called
**Then** the control's `assigned_to` field is updated and the status transitions to `in_review`
**And** the AI task instruction is persisted on the assignment record
**And** the assignment is written to `platform_audit_logs`

**Given** `POST /v1/controls/:id/assign` triggers AI instruction generation
**When** `claude-sonnet-4-6` is called synchronously via `packages/ai`
**Then** the instruction is returned within 5 seconds at the 95th percentile
**And** the prompt uses only structured metadata (control name, framework reference, connected integration names) — no raw evidence files passed to the LLM
**And** the instruction is in plain English with step-by-step guidance; compliance codes are never the headline

**Given** the tenant's connected integrations change after a control is assigned
**When** the control's assignment is next viewed
**Then** the AI task instruction is regenerated to reflect the current integration configuration
**And** the control owner is notified that their instructions have been updated

### Story 3.4: Control Owner D4 Clarity First View (`/my-tasks`)

As a Control Owner,
I want a simple, jargon-free task view showing only my assigned controls,
So that I can complete my compliance responsibilities without navigating the full platform or asking for help.

**Acceptance Criteria:**

**Given** a Control Owner logs in and is routed to `/my-tasks`
**When** the page renders
**Then** a hero section shows: "You have [N] task to complete" and "2 controls are automated — nothing needed from you"
**And** one `ActionSpotlight` card is shown per assigned task with a plain-English title, plain-English description, and a "Start review →" primary CTA
**And** no compliance codes (e.g. "CC6.1", "ISO A.9.2") appear anywhere on this view

**Given** a Control Owner clicks "Why is this needed?" on an `ActionSpotlight` card
**When** the inline expander opens
**Then** an AI-generated plain-English explanation appears without navigation away from the page
**And** the explanation does not contain audit jargon; it explains the business reason in 2–3 sentences

**Given** a Control Owner completes a task (evidence uploaded and confirmed)
**When** the submission is processed
**Then** the `ActionSpotlight` card transitions to a `complete` variant with a checkmark bloom animation (300ms)
**And** the hero count decrements: "You have [N-1] tasks to complete"
**And** if all tasks are complete, the hero reads "You're all clear. No tasks assigned to you right now." with no further CTAs

**Given** a Control Owner has no assigned tasks
**When** `/my-tasks` loads
**Then** the page shows: "You're all clear. No tasks assigned to you right now." — a positive empty state, not an error

**Given** `/my-tasks` is accessed by an Audit Director role
**When** the routing logic runs
**Then** they are redirected to `/dashboard` — the D4 view is exclusively for the `ControlOwner` role

### Story 3.5: Gap Remediation Tracking & Framework Completion Progress

As an Audit Director,
I want to track remediation progress and framework completion percentage in real time,
So that I can report on compliance status at any point in the audit cycle without manual counting.

**Acceptance Criteria:**

**Given** an Audit Director views any framework in the control library
**When** the framework view renders
**Then** a progress bar shows the framework completion percentage (passing controls / total controls × 100)
**And** the count of controls in each state (passing, needs attention, failing, pending) is displayed

**Given** a control status changes (e.g. evidence collected → passing)
**When** the status change event fires via SSE
**Then** the framework completion percentage updates in real time without a page reload
**And** the `ControlCard` for the affected domain reflects the new state within 5 seconds

**Given** an Audit Director clicks on a gap (amber or red control) in the framework view
**When** the `SidePanel` opens
**Then** it shows the control detail, current status, assigned owner (if any), due date (if set), and the specific remediation step required
**And** an "Assign" button is visible if the control has no owner — one click to fix the gap

**Given** an Audit Director wants a summary of all open gaps across all active frameworks
**When** they navigate to the Gaps view
**Then** all amber and red controls are listed sorted by severity (red first), with framework badge, domain, owner, and last-updated date
**And** the list can be exported as CSV

---

## Epic 4: Evidence Collection, Integrations & Immutability

Evidence collects continuously from Okta, AWS, Salesforce, and Jira via webhooks-first connectivity with polling fallback; SHA-256 integrity is enforced on every ingest; control health degrades automatically on staleness or integration failure; version history and per-control conversation threads are available; Control Owners receive Slack/email notifications; developers can ingest custom evidence via REST API with a sandbox environment.

### Story 4.1: Evidence Ingestion Pipeline — SHA-256 Integrity & Immutable Storage

As a platform engineer,
I want every piece of evidence to be cryptographically hashed and stored immutably on ingest,
So that evidence integrity can be verified by external auditors and cannot be tampered with after collection.

**Acceptance Criteria:**

**Given** any evidence file arrives at the ingestion pipeline (via integration, manual upload, or API)
**When** the pipeline processes the file
**Then** a SHA-256 hash is computed on the file content before any storage write
**And** a `SELECT 1 FROM evidence_blobs WHERE content_hash = $hash` deduplication check runs before the Cloud Storage write
**And** on a cache miss the blob is uploaded to Cloud Storage with Object Retention Lock enabled, then `evidence_blobs` and `evidence_items` records are inserted
**And** on a cache hit a new `evidence_items` metadata record is created pointing to the existing blob — no duplicate upload occurs

**Given** an evidence blob has been stored
**When** an export is requested
**Then** the SHA-256 hash is re-verified against the stored blob before the export is served
**And** if the hash does not match, the export is rejected with an integrity error and an alert is raised

**Given** any attempt is made to update or delete an existing `evidence_blobs` record
**When** the database operation is attempted
**Then** it is rejected at the database layer (no `UPDATE` or `DELETE` grants on `evidence_blobs`)
**And** the attempt is logged to `platform_audit_logs`

### Story 4.2: Manual Evidence Upload & EvidenceRow Component

As a control owner or Audit Director,
I want to manually upload evidence files to specific controls,
So that I can provide evidence that cannot be collected automatically from integrations.

**Acceptance Criteria:**

**Given** a user opens a control in the `SidePanel` and navigates to the Evidence tab
**When** the evidence list renders
**Then** each evidence item is displayed as an `EvidenceRow` with: file type icon, file name, source chip, timestamp, SHA-256 hash indicator, `StatusChip`, and an action menu
**And** a drag-and-drop upload zone is visible with accepted file types and maximum size listed inline
**And** a fallback file picker button is always present — drag-and-drop is never the only upload mechanism

**Given** a user drags a file onto the upload zone or selects via file picker
**When** the upload begins
**Then** a progress bar shows upload completion percentage
**And** on success the new file appears as an `EvidenceRow` with `StatusChip` variant `pending` while the SHA-256 hash is computed
**And** once hashing completes the `StatusChip` updates to `current` and the hash tooltip shows "SHA-256: [hash]" on hover

**Given** a user uploads a file that exceeds the tier storage limit
**When** the upload is attempted
**Then** the upload is rejected with a clear error: "Storage limit reached for your plan. Upgrade to add more evidence."
**And** no partial file is stored

**Given** an Audit Director sets an uploaded evidence item as "current"
**When** the designation is saved
**Then** the previous "current" item becomes "archived" — clearly subordinate in the UI
**And** only one item per control can hold the `current` designation at any time

### Story 4.3: Evidence Version History & Per-Control Conversation Threads

As an Audit Director or control owner,
I want to view the full version history of a control's evidence and communicate inline about it,
So that audit trails are complete and evidence gaps are resolved without email chains.

**Acceptance Criteria:**

**Given** a control has multiple evidence uploads over time
**When** the Evidence tab of the `SidePanel` is viewed
**Then** version history is accessible via a "Show history" toggle
**And** previous versions are displayed with dimmed styling clearly subordinate to the current item
**And** the canonical "current" designation is visually prominent with a `current` badge

**Given** an Audit Director or auditor wants to comment on an evidence item
**When** they open the Thread tab in the `SidePanel`
**Then** a threaded conversation is shown with states: comment → response → re-upload → resolution
**And** each thread entry shows the author, timestamp, and their role
**And** the thread supports re-uploading a new evidence file directly within the thread

**Given** a thread is marked resolved
**When** the resolution is saved
**Then** the thread status updates to `resolved` and is visually collapsed but accessible
**And** the resolution is logged to `platform_audit_logs` with actor and timestamp

**Given** a control has an unresolved thread comment
**When** the `ControlCard` for that domain is viewed on the dashboard
**Then** a thread indicator badge is visible on the card signalling pending discussion
**And** clicking the indicator opens the `SidePanel` directly to the Thread tab

### Story 4.4: Native Integration Setup & Health Dashboard

As an Organisation Admin,
I want to connect Okta, AWS, Salesforce, and Jira through a no-code interface and monitor their health,
So that evidence collection begins automatically without manual uploads or API configuration.

**Acceptance Criteria:**

**Given** an Org Admin navigates to `/integrations`
**When** the integration catalogue loads
**Then** four native integrations are shown: Okta, AWS, Salesforce, Jira — each with a connection status chip and a "Connect" button

**Given** an Org Admin clicks "Connect" on an OAuth-based integration (Okta, Salesforce, Jira)
**When** the OAuth flow is initiated
**Then** the user is redirected to the provider's OAuth consent screen
**And** on successful authorisation the credentials are stored in GCP Secret Manager with tenant-specific encryption — never in the application database
**And** the integration status chip updates to `connected` and the "Last synced" timestamp shows "Just now"

**Given** an Org Admin connects AWS via IAM role configuration
**When** the configuration is saved
**Then** the platform validates the IAM role has the minimum required permissions (least-privilege scopes documented in the UI)
**And** a test evidence pull is triggered to confirm connectivity before marking the integration as `connected`

**Given** an Org Admin wants to configure a custom polling interval
**When** they open the integration settings
**Then** they can set a polling interval between 1 hour and 24 hours (default: 4 hours)
**And** the change takes effect on the next scheduled poll without requiring a reconnection

**Given** all connected integrations are displayed on the health dashboard
**When** the page renders
**Then** each integration shows: status chip, last synced timestamp, evidence items collected in the last 24h, and a "Disconnect" action
**And** the page data refreshes every 30 seconds via TanStack Query polling

### Story 4.5: Automated Continuous Evidence Collection

As an Audit Director,
I want evidence to be collected continuously from connected integrations and reflected in control health automatically,
So that controls turn green as evidence arrives without any manual steps.

**Acceptance Criteria:**

**Given** a connected integration sends a webhook event
**When** the webhook arrives at `POST /v1/webhooks/integrations`
**Then** the HMAC signature is verified before processing
**And** an `evidence-sync` Cloud Tasks job is enqueued immediately
**And** the worker processes the job and stores the evidence through the SHA-256 immutability pipeline
**And** the evidence item's `source_system` and `last_synced_at` fields are populated from the webhook metadata

**Given** an integration does not support webhooks (poll-only)
**When** the scheduled poll cycle runs (default every 4 hours)
**Then** the `integration-poll` worker job fetches new evidence since the last poll cursor
**And** all new evidence items are stored through the immutability pipeline with the correct `source_system` and `last_synced_at`

**Given** new evidence is stored for a control
**When** the evidence passes the ingestion pipeline
**Then** the control's health status is re-evaluated and updated in the database
**And** if the new evidence brings the control into a passing state, a `control.passed` domain event is published to Redis pub/sub
**And** the SSE stream delivers the update to any connected dashboard clients within 5 minutes of the original webhook event

**Given** a control has evidence from a connected integration
**When** an Audit Director views any evidence item
**Then** the `EvidenceRow` shows the source integration chip and the exact "Last synced: [timestamp]"

### Story 4.6: Staleness Detection, Control Degradation & Notifications

As an Audit Director or control owner,
I want to be alerted when integrations fail or evidence goes stale and see controls degrade automatically,
So that audit gaps are surfaced in real time rather than discovered during an audit.

**Acceptance Criteria:**

**Given** an integration stops sending webhook events or a poll cycle fails
**When** the integration failure is detected by the health monitoring service
**Then** detection occurs within 1 hour of the failure
**And** the integration status chip updates to `degraded` or `failed`
**And** the Org Admin and assigned control owners receive an in-app notification and email within 4 hours

**Given** evidence for a control has not been refreshed within the staleness threshold (default 30 days)
**When** the staleness check runs
**Then** the control's health status automatically degrades: `pass` → `warn` if evidence is stale; `warn` → `fail` if the integration has been failing beyond the escalation period
**And** a `control.degraded` domain event is published to Redis pub/sub and delivered via SSE to the dashboard within 5 minutes

**Given** an integration failure is resolved (e.g. credentials rotated)
**When** the integration reconnects
**Then** the status resets to `connected` and a re-sync job is enqueued immediately
**And** once fresh evidence is collected, affected controls recover their health status automatically

**Given** a control owner has notifications configured for Slack
**When** they are assigned a control or a control they own degrades to red
**Then** a Slack message is sent to their configured channel with the control name, status, and a direct link to `/my-tasks`
**And** the notification is also sent via email as a fallback regardless of Slack configuration

### Story 4.7: REST API Evidence Ingestion, Webhooks & Developer Sandbox

As a developer building a custom integration,
I want to ingest evidence via REST API and test against an isolated sandbox,
So that I can connect any proprietary system to the platform without building a native connector.

**Acceptance Criteria:**

**Given** a developer sends a `POST /v1/evidence` request with a valid API key and structured payload
**When** the request is processed
**Then** the payload schema is validated against the `evidenceUploadSchema` Zod schema from `packages/types`
**And** valid payloads are processed through the SHA-256 immutability pipeline and mapped to the specified control
**And** invalid payloads return `400` with field-level validation errors: `{ error: { code: "VALIDATION_ERROR", details: [...] } }`

**Given** a developer configures a webhook endpoint to push events to the platform
**When** a webhook event is received at `POST /v1/webhooks/custom`
**Then** the HMAC signature (using the tenant's webhook secret from Secret Manager) is verified before processing
**And** valid events are processed through the same ingestion pipeline as native integration webhooks

**Given** a developer wants to test their integration without affecting production audit records
**When** they use sandbox credentials (API key prefixed `sk_sandbox_`)
**Then** all evidence ingested lands in an isolated non-production tenant schema
**And** sandbox evidence is clearly labelled and never appears in audit records or reports
**And** the sandbox can be reset at any time via `DELETE /v1/sandbox/reset`

**Given** a developer makes requests that exceed the rate limit for their tier
**When** the rate limit is breached
**Then** the API returns `429 Too Many Requests` with a `Retry-After` header
**And** rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are returned on every API response

---

## Epic 5: Audit Lifecycle & Board-Ready Reporting

Audit Directors can create formal audit engagements with defined scope, require explicit sign-off before opening, track open findings with owners and due dates across cycles, and generate a board-ready PDF + interactive HTML audit report in a single action in under 60 seconds.

### Story 5.1: Audit Engagement Creation & Scope Management

As an Audit Director,
I want to create and manage formal audit engagements with defined scope and timelines,
So that each audit cycle has a clear record of what was in scope and who was responsible.

**Acceptance Criteria:**

**Given** an Audit Director navigates to `/audits` and clicks "New audit"
**When** the creation form is submitted
**Then** a new audit record is created with: name, framework(s) in scope, date range, assigned controls, and the creator as audit owner
**And** the audit status is set to `draft` and it appears in the audit list

**Given** an audit is in `draft` status
**When** the Audit Director edits it
**Then** they can add or remove controls from scope, adjust the date range, and add notes
**And** all edits are logged to `platform_audit_logs` with the previous and new values

**Given** an Audit Director views the audit list
**When** the list renders
**Then** audits are shown with: name, frameworks, date range, status chip (draft/open/closed), control count, and finding count
**And** clicking an audit opens its detail view with full scope, workpapers, and finding list

### Story 5.2: Pre-Audit Sign-Off Checklist & Audit Opening

As an Audit Director,
I want to require explicit scope confirmation before an audit is opened,
So that no audit begins on an incomplete or unreviewed control set.

**Acceptance Criteria:**

**Given** an Audit Director attempts to open a `draft` audit
**When** they click "Open audit"
**Then** a sign-off checklist modal appears listing: framework scope confirmed, all controls assigned, date range finalised, and workpapers accessible
**And** each checklist item has a checkbox that must be ticked before the primary CTA is enabled

**Given** any checklist item is incomplete (e.g. unassigned controls exist)
**When** the checklist modal renders
**Then** the incomplete item is highlighted in amber with a specific link to resolve it (e.g. "3 controls have no owner — assign them")
**And** the "Open audit" CTA remains disabled until all items are checked

**Given** all checklist items are confirmed and the Audit Director clicks "Open audit"
**When** the sign-off is submitted
**Then** the audit status changes from `draft` to `open`
**And** a `audit.opened` event is written to `platform_audit_logs` with the sign-off timestamp and actor
**And** the audit can no longer have its scope changed without explicit re-confirmation

### Story 5.3: Open Findings Tracking

As an Audit Director,
I want to track open findings across audit cycles with owners, due dates, and resolution history,
So that nothing falls through the cracks between audit periods.

**Acceptance Criteria:**

**Given** an Audit Director creates a finding during an audit
**When** the finding is saved
**Then** it is recorded with: title, severity (critical/high/medium/low), description, linked control, assigned owner, due date, and status `open`
**And** the finding appears in the audit's findings list and in the global findings view at `/audits/findings`

**Given** an open finding's due date passes without resolution
**When** the daily staleness check runs
**Then** the finding's `StatusChip` updates to show it is overdue (amber border + "Overdue" label)
**And** the assigned owner receives an email notification

**Given** an owner marks a finding as resolved
**When** the resolution is submitted
**Then** the finding status changes to `resolved` with a resolution note and timestamp
**And** the Audit Director can re-open the finding if the resolution is insufficient — this creates a new revision entry in the finding history

**Given** an Audit Director views the global findings view
**When** filters are applied (by audit cycle, severity, owner, or status)
**Then** findings update immediately
**And** the view shows a summary count: open / overdue / resolved this cycle

### Story 5.4: Board-Ready Audit Report Generation

As an Audit Director,
I want to generate a board-ready audit report in a single action from completed workpapers,
So that I can produce a polished deliverable in under 60 seconds rather than spending weeks on manual assembly.

**Acceptance Criteria:**

**Given** an open audit has completed workpapers and the Audit Director clicks "Generate report"
**When** the sign-off checklist is confirmed
**Then** `POST /v1/audits/:id/reports` enqueues a `report-generate` Cloud Tasks job and immediately returns `202 Accepted` with `{ jobId }`
**And** the UI shows an animated assembly sequence: a progress arc with section labels streaming in one by one (Executive Summary → Control Health Summary → Open Findings → Evidence Coverage → Remediation Status)

**Given** the report generation worker processes the job
**When** `claude-opus-4-7` assembles the report via `packages/ai`
**Then** only structured metadata is passed to the LLM — no raw evidence file content
**And** every AI-generated section carries a disclaimer: "AI-assisted · Review before sharing"
**And** the complete job runs in under 60 seconds for audits with up to 500 evidence items

**Given** the report generation job completes
**When** the `report.generated` domain event fires
**Then** the SSE stream delivers the completion notification to the client within 30 seconds of job completion
**And** the report preview opens in a new browser tab as interactive HTML with expandable findings

**Given** the Audit Director wants minor edits before sharing
**When** they enter inline edit mode
**Then** specific text sections are editable inline
**And** edited sections are clearly marked "Edited by [name]" in the final output

### Story 5.5: Audit Report Export — PDF & Interactive HTML

As an Audit Director,
I want to export the generated report as PDF and interactive HTML with chain-of-custody metadata,
So that external stakeholders receive a deliverable that proves evidence provenance.

**Acceptance Criteria:**

**Given** a report has been generated and reviewed
**When** the Audit Director clicks "Download PDF"
**Then** a PDF is generated containing: all report sections, chain-of-custody metadata (evidence hash, collection source, timestamp per item), an AI disclaimer footer, and the tenant's name and audit date on the cover page

**Given** the Audit Director uses the "Share with board" option
**When** the action is triggered
**Then** an email is sent to the configured board distribution list with a link to the interactive HTML report
**And** the link is time-limited (default 90 days) and read-only
**And** the email send is logged to `platform_audit_logs`

**Given** an external stakeholder opens the interactive HTML report link
**When** the report renders
**Then** findings are expandable/collapsible inline
**And** each evidence item shows its source, timestamp, and SHA-256 hash for provenance verification
**And** the report header includes: "Generated with AI assistance — not a substitute for a qualified auditor"

**Given** an audit is marked closed after report delivery
**When** the audit status changes to `closed`
**Then** the audit record, all workpapers, evidence references, and the generated report are preserved immutably
**And** the closed audit appears in the audit history with a "View report" link

---

## Epic 6: Risk Intelligence & Year-Round Engagement

The compliance trajectory score rolls as a continuous health indicator; users receive automated weekly compliance digest emails; real-time regulatory change alerts fire when relevant framework updates are detected; a risk register maps risks to controls with owners, likelihood, impact, and remediation status — making GRC a year-round habit, not a seasonal panic.

### Story 6.1: Compliance Trajectory Score

As an Audit Director or Org Admin,
I want a rolling compliance trajectory score that reflects overall control health over time,
So that I can show the board a single number that communicates our compliance posture without requiring them to read a full report.

**Acceptance Criteria:**

**Given** a tenant has active controls with health data
**When** the trajectory score is computed by `trajectory.service.ts`
**Then** the score is a rolling weighted percentage (0–100) based on passing controls, recency of evidence, and framework completion across all active frameworks
**And** the score is recomputed whenever a `control.passed` or `control.degraded` event fires
**And** a historical snapshot is appended to `control_health_snapshots` on every score change

**Given** the compliance dashboard loads
**When** the `HealthSummaryBar` renders
**Then** the trajectory score is displayed as the fourth metric card with its current value and the quarterly change delta (e.g. "+12 pts this quarter")
**And** the delta is colour-coded: green for improvement, red for regression

**Given** the trajectory score changes by more than 5 points in a 7-day window
**When** the change is detected
**Then** the Audit Director receives an in-app notification with the change magnitude and the top contributing factor (e.g. "3 AWS controls went stale")

**Given** a Read-Only Stakeholder views their scoped dashboard
**When** the trajectory score section renders
**Then** it shows the current score, quarterly trend, and a one-line plain-English summary
**And** no operational controls data is visible to this role

### Story 6.2: Automated Weekly Compliance Digest

As an Audit Director,
I want to receive an automated weekly digest email summarising compliance health changes and upcoming obligations,
So that I stay on top of the platform without needing to log in every day.

**Acceptance Criteria:**

**Given** a tenant has an Audit Director with email notifications enabled
**When** the weekly digest job runs (every Monday, 08:00 tenant timezone)
**Then** an email is sent containing: overall trajectory score vs last week, count of controls that changed status, top 3 items needing attention, and any upcoming audit deadlines in the next 30 days

**Given** the digest email is opened
**When** the recipient reads it
**Then** every item links directly to the relevant view in the platform
**And** the email footer contains a one-click "Unsubscribe from digest" link

**Given** a tenant has no new activity since the last digest (all controls green, no changes)
**When** the digest job evaluates whether to send
**Then** a digest is still sent with a brief "All clear — no changes this week" summary
**And** the "all clear" digest reinforces the continuous monitoring value even during quiet weeks

**Given** an Org Admin wants to configure digest frequency
**When** they open Settings → Notifications
**Then** they can set per-user digest frequency: weekly (default), daily, or disabled
**And** the change takes effect immediately for future sends

### Story 6.3: Regulatory Change Alerts

As an Audit Director,
I want to receive alerts when monitored regulatory bodies publish updates relevant to my active frameworks,
So that I can act on regulatory changes before they create audit gaps.

**Acceptance Criteria:**

**Given** the `regulatory-scan` worker job runs (daily)
**When** it detects a relevant regulatory update (GDPR guidance, ISO 27001 amendment, SOC 2 criteria change, NIST CSF update)
**Then** the update is stored with: source, publication date, affected frameworks, and a plain-English summary
**And** all tenants with the affected framework(s) active receive an in-app notification and email alert

**Given** a regulatory change alert is delivered
**When** the Audit Director views it in the notifications panel
**Then** it shows: the regulatory body, the change summary, the affected framework(s), and a "Review impact" CTA
**And** clicking "Review impact" opens a filtered control view showing potentially affected controls

**Given** a regulatory alert has been reviewed by the Audit Director
**When** they mark it as "Reviewed"
**Then** the alert is archived and the reviewed status with reviewer name and timestamp is logged
**And** the notification badge clears for that alert

**Given** the platform cannot determine which specific controls are affected by a regulatory change
**When** the alert is generated
**Then** it is labelled "Manual review recommended" rather than mapping to controls speculatively
**And** the alert clearly states which framework and section the change relates to

### Story 6.4: Risk Register

As an Audit Director,
I want a risk register where I can document risks mapped to controls with owners, likelihood, impact, and remediation status,
So that risk management is integrated with compliance operations rather than living in a separate spreadsheet.

**Acceptance Criteria:**

**Given** an Audit Director navigates to `/risk`
**When** the risk register loads
**Then** existing risks are listed with: risk title, likelihood (1–5), impact (1–5), risk score (likelihood × impact), assigned owner, linked control(s), and remediation status chip (open/in-progress/mitigated/accepted)

**Given** an Audit Director creates a new risk
**When** the risk form is submitted
**Then** the risk is saved with all required fields and appears in the register
**And** the risk can be linked to one or more existing controls from the control library
**And** the creation is logged to `platform_audit_logs`

**Given** a risk is linked to a control that degrades to `fail` status
**When** the control health change event fires
**Then** the linked risk's status is automatically flagged as "Control failing — review risk" with an amber indicator
**And** the risk owner receives a notification

**Given** an Audit Director views a risk detail
**When** the detail panel opens
**Then** it shows: full description, risk score, linked controls with their current health status, remediation plan (freetext), owner, and full status history
**And** the risk score can be updated inline with a reason for the change recorded

**Given** the risk register summary renders
**When** the summary section loads
**Then** risks are grouped by score tier: Critical (≥20), High (12–19), Medium (6–11), Low (1–5)
**And** a count per tier is displayed as a summary row above the list

---

## Epic 7: Platform Administration & Developer Portal

Org Admins manage subscription tier, billing preferences, and track usage against tier limits; full tenant data export is available at any time; developers manage API keys, webhook endpoints, and sandbox credentials through a developer portal; platform operators access the tamper-evident audit log UI.

### Story 7.1: Subscription, Billing & Usage Management

As an Organisation Admin,
I want to manage our subscription tier and billing preferences and see live usage against our plan limits,
So that I can control costs and understand when we need to upgrade.

**Acceptance Criteria:**

**Given** an Org Admin navigates to Settings → Billing
**When** the billing page loads
**Then** it shows: current tier, billing cycle, next renewal date, and a usage summary card for each metered dimension (evidence storage, AI co-pilot queries, active integrations, user seats)

**Given** usage for any dimension reaches 80% of the tier limit
**When** the usage check runs
**Then** an amber warning banner appears on the billing page and the Org Admin receives an email notification
**And** the warning names the specific dimension approaching the limit

**Given** usage for any dimension reaches 100% of the tier limit
**When** the limit is hit
**Then** the relevant feature is soft-blocked with a clear in-context message: "You've reached your [feature] limit. Upgrade to continue."
**And** the soft-block applies to new actions only — existing data is never deleted or hidden due to a limit being reached

**Given** an Org Admin selects a new subscription tier
**When** they confirm the upgrade
**Then** the tier change takes effect immediately for feature access
**And** the prorated billing adjustment is shown before confirmation with an explicit "Confirm upgrade" button
**And** the tier change is logged to `platform_audit_logs`

**Given** an Org Admin switches from monthly to annual billing
**When** the billing preference is saved
**Then** the 10% annual prepay discount is applied to the next invoice
**And** the billing page confirms the new renewal date and discounted annual price

### Story 7.2: Full Tenant Data Export

As an Organisation Admin,
I want to export all of our tenant data at any time in full,
So that we are never locked in and can migrate or archive our compliance history on demand.

**Acceptance Criteria:**

**Given** an Org Admin clicks "Export all data" in Settings → Data & Export
**When** the export job is enqueued
**Then** the Org Admin receives a confirmation: "Your export is being prepared. You'll receive an email with the download link when it's ready."
**And** the export includes: all controls and history, all evidence items with metadata, all audit records and findings, all generated reports, and all `platform_audit_logs` entries for the tenant

**Given** the export job completes
**When** the download link is delivered via email
**Then** the link provides a ZIP archive containing: a structured JSON manifest, evidence files with their SHA-256 hashes, and all reports as PDFs
**And** the link is valid for 72 hours and requires authentication to download

**Given** a tenant's subscription is cancelled
**When** the cancellation is processed
**Then** tenant data is retained for 30 days post-cancellation with reminder emails at Day 1, Day 15, and Day 28
**And** at Day 30 the tenant data is purged and a deletion confirmation is sent

**Given** a tenant has SOX-regulated evidence
**When** an export or deletion request is processed
**Then** SOX evidence within its 7-year retention window is flagged and cannot be purged
**And** any GDPR erasure vs SOX retention conflict is surfaced explicitly — the Org Admin must make the policy decision with documented rationale

### Story 7.3: Developer Portal — API Key & Webhook Management

As a Developer,
I want to manage API keys, webhook endpoints, and sandbox credentials from a single portal,
So that I can configure and maintain custom integrations without involving a platform admin.

**Acceptance Criteria:**

**Given** a Developer navigates to `/developer`
**When** the portal loads
**Then** they see three sections: API Keys, Webhook Endpoints, and Sandbox
**And** the portal is only accessible to users with the `Developer` role — other roles receive 403

**Given** a Developer clicks "Create API key"
**When** the creation modal is submitted with a name and optional expiry date
**Then** a new API key is generated with the prefix `sk_live_` and displayed in full exactly once
**And** after closing the modal the key is shown only as `sk_live_...` with the last 4 characters — never in full again
**And** the key creation is logged to `platform_audit_logs`

**Given** a Developer creates a webhook endpoint
**When** the endpoint URL is saved
**Then** a webhook secret is generated and displayed once for the developer to configure in their system
**And** the platform sends a test POST to the endpoint URL and shows the HTTP response status
**And** the endpoint appears in the webhook list with: URL, creation date, last triggered timestamp, and a "Disable" action

**Given** a Developer wants to test their integration without affecting production
**When** they navigate to the Sandbox section
**Then** they see their sandbox API key (prefixed `sk_sandbox_`), a "Reset sandbox" button, and a sandbox activity log showing recent test evidence ingestions
**And** clicking "Reset sandbox" clears all sandbox evidence and resets the isolated sandbox tenant

### Story 7.4: Tamper-Evident Audit Log Access

As a Platform Operator or Org Admin,
I want to view and export the tamper-evident audit log for all platform actions,
So that I can demonstrate to auditors that every action on the platform has a complete, unmodified record.

**Acceptance Criteria:**

**Given** an Org Admin navigates to Settings → Audit Log
**When** the audit log view loads
**Then** log entries are displayed in reverse-chronological order with: timestamp, actor (name + role), action type, resource type, resource ID, and IP address
**And** entries are read-only — no edit, delete, or bulk-action controls are present in the UI

**Given** an Org Admin applies filters (by actor, action type, date range, or resource type)
**When** the filter is applied
**Then** the log updates immediately
**And** the filter state is preserved if the page is refreshed within the same session

**Given** an Org Admin clicks "Export audit log"
**When** the export is generated
**Then** a CSV or JSON file is produced containing all filtered log entries
**And** the export itself is logged as a new entry in `platform_audit_logs`

**Given** a Scale tier tenant requests audit log export
**When** the export is requested via `GET /v1/export/audit-log`
**Then** the export covers only that tenant's entries (strict tenant scoping enforced)
**And** the GCP Cloud Logging export sink provides an off-platform copy as a second tamper-evidence layer for Scale tier

---

## Epic 8: External Auditor Portal & Collaboration *(Growth)*

Audit Directors invite external auditors via time-limited scoped UUID tokens to a structured evidence room; auditors navigate by domain, flag insufficiencies, leave inline comments; Audit Directors see flags immediately; tokens are revocable at any time.

### Story 8.1: External Auditor Access Token Issuance & Revocation

As an Audit Director,
I want to issue time-limited, scoped access tokens to external auditors and revoke them at any time,
So that auditors can access exactly the evidence they need without requiring a platform account.

**Acceptance Criteria:**

**Given** an Audit Director opens an open audit and clicks "Invite external auditor"
**When** the invitation form is submitted with auditor name, email, and expiry date (default 30 days)
**Then** a UUID v7 token is generated and stored in `audit_access_tokens` with `(audit_id, scoped_control_ids[], created_by, expires_at)`
**And** an invitation email is sent to the auditor with a unique link `/audit/:token`
**And** the token creation is logged to `platform_audit_logs` with the auditor's name and expiry

**Given** an Audit Director views the Auditors tab on an audit
**When** the tab renders
**Then** all issued tokens are listed with: auditor name, issue date, expiry date, last accessed timestamp, and status (active/expired/revoked)

**Given** an Audit Director clicks "Revoke" on an active token
**When** the revocation is confirmed via `AlertDialog`
**Then** `revoked_at` is set on the `audit_access_tokens` record immediately
**And** the Redis cache entry for that token is invalidated within 60 seconds
**And** the next request from that token receives `401 Unauthorized`

**Given** a token's expiry date is reached
**When** the auditor attempts to use it
**Then** the platform returns `401` with a clear message: "Your access to this audit has expired. Contact the audit owner to request a new link."

### Story 8.2: Scoped Evidence Room for External Auditors

As an External Auditor,
I want to navigate a structured evidence room scoped to my assigned audit,
So that I can review and download evidence efficiently without email chains or access to unrelated data.

**Acceptance Criteria:**

**Given** an external auditor opens their invitation link `/audit/:token`
**When** the token is validated
**Then** they land on the scoped evidence room showing only the controls within their token's scope
**And** the Fastify middleware validates the UUID v7 token on every request — not a Clerk session
**And** no other tenant data, controls outside scope, or platform navigation is accessible

**Given** the external auditor views the evidence room
**When** the page renders
**Then** controls are organised by domain with filters for: domain, framework, and evidence status (evidenced/not evidenced/flagged)
**And** each control shows its `StatusChip`, evidence count, last updated timestamp, and a "Download evidence package" button

**Given** an external auditor clicks "Download evidence package" for a domain
**When** the download is prepared
**Then** a ZIP is generated containing all evidence files with a JSON manifest (source, timestamp, SHA-256 hash per item)
**And** the download is logged to `platform_audit_logs` with the token ID, auditor name, and scope

**Given** an external auditor's token is revoked while they are in the evidence room
**When** their next API request fires
**Then** they receive `401` and see: "Your access has been revoked. Contact [audit owner name] for assistance."

### Story 8.3: Inline Evidence Review, Flagging & Bidirectional Resolution

As an External Auditor,
I want to flag insufficient evidence and leave inline comments that the Audit Director can respond to,
So that fieldwork gaps are resolved within the platform rather than over email.

**Acceptance Criteria:**

**Given** an external auditor views an evidence item
**When** they click "Flag as insufficient"
**Then** they are prompted to enter a comment explaining the insufficiency
**And** the evidence item's `StatusChip` updates to `flagged` and the Audit Director receives an immediate in-app notification and email

**Given** an Audit Director sees a flagged control in their dashboard
**When** they open the `SidePanel` Thread tab
**Then** the auditor's flag comment is shown with timestamp and auditor name
**And** the Audit Director can reply inline and optionally re-upload new evidence directly in the thread

**Given** the Audit Director resolves a flagged item (reply + re-upload)
**When** the resolution is submitted
**Then** the external auditor receives a notification: "[Control name] has been updated — please review"
**And** the auditor can mark the flag as `resolved` or re-flag with a new comment
**And** the full thread history is preserved in the audit record

---

## Epic 9: AI Co-pilot & Inline Intelligence *(Growth)*

Users query audit status via a conversational AI co-pilot; all users invoke contextual AI assistance inline on any control, risk, or evidence item without leaving the current view; report generation shows the full animated ReportAssemblyProgress sequence.

### Story 9.1: Conversational Audit Co-pilot

As an Audit Director,
I want to query audit status, draft findings, and surface evidence anomalies through a conversational interface,
So that I can get instant answers and AI-drafted content without navigating multiple views.

**Acceptance Criteria:**

**Given** an Audit Director opens the co-pilot panel (sidebar or ⌘K → "Ask co-pilot")
**When** they type a query
**Then** the co-pilot streams a response using `claude-sonnet-4-6` with the first token appearing within 1 second
**And** the full response completes within 5 seconds at the 95th percentile
**And** only structured metadata is passed to the LLM — no raw evidence file content

**Given** the co-pilot generates a draft finding
**When** the draft is shown
**Then** it carries a prominent "AI-assisted · Review before using" label
**And** a "Insert as finding" button allows one-click insertion into the current open audit — no auto-insert

**Given** the co-pilot query times out (>5 seconds)
**When** the timeout fires
**Then** an inline message shows: "Taking longer than expected — [Retry]"
**And** the error stays within the co-pilot panel — no global toast or page error

**Given** the co-pilot cites a specific evidence item in a response
**When** the response renders
**Then** each cited item is linked directly to the control's `SidePanel` evidence tab

### Story 9.2: Inline AI Assistance on Controls, Risks & Evidence

As any authenticated user,
I want to invoke contextual AI assistance inline on any control, risk, or evidence item without leaving my current view,
So that I can get instant explanations, remediation suggestions, or policy drafts without switching context.

**Acceptance Criteria:**

**Given** a user right-clicks on a control, risk, or evidence item
**When** the context menu opens
**Then** an "Ask AI" option opens an inline AI panel anchored to that item — no page navigation

**Given** the inline AI panel opens for a control
**When** the user selects a suggested action (e.g. "Explain this control", "Suggest remediation", "Draft a policy")
**Then** the AI streams a response using `claude-sonnet-4-6` within 5 seconds
**And** the response is scoped to that specific control's metadata
**And** all AI-generated content carries a visible "AI-assisted" caption label

**Given** a Control Owner invokes inline AI on their assigned task in `/my-tasks`
**When** the AI panel opens
**Then** the response uses plain English with no compliance jargon — the `ControlOwner` role is detected by the `packages/ai` prompt and tone is adjusted accordingly

### Story 9.3: Report Assembly Progress Animation

As an Audit Director,
I want to see an animated assembly sequence while my audit report is being generated,
So that the wait feels productive rather than like a loading screen.

**Acceptance Criteria:**

**Given** an Audit Director triggers report generation
**When** the `report-generate` job is enqueued
**Then** the `ReportAssemblyProgress` component renders: an SVG arc filling from 0→100% driven by SSE job progress events, with section labels appearing as each section assembles

**Given** each report section completes
**When** the section completion event fires via SSE
**Then** the section label fades in with a checkmark animation and the arc advances proportionally (200ms ease-out)

**Given** a user has `prefers-reduced-motion` enabled
**When** the report generation runs
**Then** the component renders as a static progress bar with a percentage counter — no arc animation or streaming labels

**Given** the report generation job completes
**When** the final SSE event fires
**Then** the arc reaches 100%, a completion state shows for 1 second, then the report preview opens in a new tab automatically

---

## Epic 10: Regulatory Intelligence Agents *(Growth)*

The platform continuously monitors external signals (news, regulatory updates, vendor breach alerts) mapped to active control frameworks; an AI regulatory change agent assesses impact and drafts a remediation action plan.

### Story 10.1: Ambient Signal Monitoring & Control Framework Mapping

As an Audit Director,
I want the platform to continuously monitor external signals and map them to my active control framework,
So that I know in real time when external events create new risks for my compliance posture.

**Acceptance Criteria:**

**Given** the `regulatory-scan` worker job runs (daily, enhanced from Epic 6)
**When** it detects an external signal (vendor breach, regulatory update, industry news)
**Then** the signal is analysed and mapped to potentially affected controls in the tenant's active frameworks
**And** the mapping confidence (high/medium/low) is stored alongside the signal

**Given** a high-confidence signal is mapped to active controls
**When** the mapping is stored
**Then** an in-app notification appears in the Ambient Radar feed with: signal type, source, summary, affected control count, and a "Review impact" CTA
**And** affected controls receive an amber indicator in the control list

**Given** a signal is low-confidence or cannot be mapped to specific controls
**When** it is stored
**Then** it appears in the Ambient Radar feed as "General industry alert" without control mapping
**And** it does not trigger a notification or amber indicator on any control

**Given** an Audit Director dismisses a signal from the Ambient Radar feed
**When** the dismissal is saved
**Then** the signal is archived and control indicators clear
**And** the dismissal is logged so the same signal source is de-duplicated in future scans

### Story 10.2: AI Regulatory Change Impact Assessment & Action Plan

As an Audit Director,
I want an AI agent to assess the impact of a detected regulatory change on my control framework and draft a remediation action plan,
So that I can respond to regulatory changes in hours rather than weeks.

**Acceptance Criteria:**

**Given** a regulatory change signal has been detected and the Audit Director clicks "Assess impact"
**When** the assessment is triggered
**Then** an async job is enqueued using `claude-opus-4-7` to analyse the change against the tenant's active frameworks and control library
**And** the job returns within 5 minutes with: affected controls list, gap analysis, and a draft remediation action plan

**Given** the assessment completes
**When** the result is presented
**Then** it shows: which specific controls may need updating, suggested control modifications in plain English, and a prioritised action plan
**And** all AI-generated content is labelled "AI-assisted · Review before acting" and requires explicit user confirmation before any control is modified

**Given** the Audit Director approves the action plan
**When** they click "Create remediation tasks"
**Then** approved items are created as findings in the current open audit with the action plan as the finding description
**And** the Audit Director can assign owners and due dates before confirming

---

## Epic 11: Enterprise Access Management *(Growth)*

Enterprise customers authenticate via SAML 2.0/OIDC SSO; admins configure SCIM automated provisioning/deprovisioning with immediate session invalidation; group-to-role mapping automates role assignment from IdP groups; board members and executives access a read-only compliance summary via magic link.

### Story 11.1: SSO Authentication (SAML 2.0 & OIDC)

As an Organisation Admin on Growth+ tier,
I want to configure SSO so that all users authenticate through our identity provider,
So that we maintain centralised access control and eliminate separate platform passwords.

**Acceptance Criteria:**

**Given** an Org Admin navigates to Settings → Authentication (Growth+ gated)
**When** they configure a SAML 2.0 or OIDC identity provider
**Then** they can enter IdP metadata (Entity ID, SSO URL, certificate) or an OIDC discovery URL
**And** a "Test SSO connection" button validates the configuration before saving

**Given** SSO is configured and a user attempts to log in
**When** they enter their email on the login page
**Then** they are redirected to the configured IdP for authentication automatically
**And** on successful IdP authentication a Clerk session is created and the user lands on their role-appropriate view

**Given** an SSO user is removed from the IdP
**When** the next authentication attempt occurs
**Then** the user cannot create a new session
**And** if SCIM is configured, the deprovisioning event invalidates any existing sessions immediately

### Story 11.2: SCIM Automated User Provisioning & Deprovisioning

As an Organisation Admin on Growth+ tier,
I want to automate user provisioning and deprovisioning via SCIM so that our platform roster stays in sync with our IdP,
So that access is granted on day one and revoked immediately when someone leaves.

**Acceptance Criteria:**

**Given** an Org Admin configures SCIM in Settings → Authentication
**When** the SCIM endpoint and bearer token are saved
**Then** the Clerk SCIM endpoint is active and the Org Admin can test the connection from Okta or Azure AD

**Given** a new user is provisioned via SCIM
**When** the SCIM `POST /Users` request arrives
**Then** a platform user account is created with default role `ControlOwner`
**And** the user can log in immediately via SSO

**Given** a user is deprovisioned via SCIM
**When** the deprovisioning event is processed
**Then** the user's account is deactivated and all active Clerk sessions are invalidated immediately
**And** the Redis session cache entry is flushed within 1 second
**And** the deprovisioning is logged to `platform_audit_logs`

### Story 11.3: SCIM Group-to-Role Mapping Rules

As an Organisation Admin on Growth+ tier,
I want to configure rules that automatically assign platform roles based on IdP group membership,
So that role assignment is automatic and always in sync with our organisational structure.

**Acceptance Criteria:**

**Given** an Org Admin navigates to Settings → Authentication → Role Mapping
**When** the role mapping configuration loads
**Then** they can create rules of the form: "IdP group [name] → Platform role [role]"
**And** multiple groups can map to the same role

**Given** a SCIM provisioning event includes group membership
**When** the Clerk webhook processes the event
**Then** the group-to-role rules are evaluated and the user is assigned the matching platform role
**And** if multiple rules match, the highest-privilege role wins

**Given** a user is moved to a different IdP group
**When** the SCIM group update arrives
**Then** the user's platform role updates within 1 minute
**And** if the role change reduces privileges, existing sessions are invalidated and the user must re-authenticate

### Story 11.4: Board/Executive Portal with Trajectory Score Ring

As a Board member or Executive,
I want to access a read-only compliance summary via a magic link on any device,
So that I can review our compliance posture before a board meeting without logging into the full platform.

**Acceptance Criteria:**

**Given** an Audit Director generates a board access link in Settings → Board Portal
**When** the link is created
**Then** a magic link is sent to the configured board distribution list
**And** the link grants a `BoardExecutive` role session scoped to read-only dashboard data

**Given** a board member opens the magic link on any device
**When** the portal loads
**Then** the D6 Board Portal renders: a `BoardScoreRing` (100×100px SVG ring coloured by threshold: ≥80=green, 60–79=amber, <60=red), open findings count, quarterly trend, and a one-line plain-English summary
**And** the portal is fully responsive down to 375px (single-column layout)
**And** no operational controls data, evidence, or audit details are accessible

**Given** a board magic link expires (default 30 days)
**When** the link is opened after expiry
**Then** the user sees: "This link has expired. Contact your compliance team for a new one." — no platform login prompt

---

## Epic 12: Scale & Enterprise Administration *(Growth/Scale)*

Scale tier admins select EU data residency region at provisioning; Scale tier supports multiple independent business units with separate framework configs, user pools, and dashboards; Scale tier customers supply their own encryption keys (BYOK).

### Story 12.1: EU Data Residency Selection at Provisioning

As a Scale tier Org Admin,
I want to select our data residency region when provisioning our tenant,
So that all our compliance data is stored and processed within the EU as required by GDPR.

**Acceptance Criteria:**

**Given** a new Scale tier tenant is being provisioned
**When** the provisioning form is shown
**Then** a data residency selector presents options: US (default) and EU (AWS eu-west / eu-central)
**And** a prominent warning is shown: "Data residency cannot be changed after provisioning. Choose carefully."

**Given** EU data residency is selected and provisioning completes
**When** any tenant data is written
**Then** all database writes go to the Cloud SQL instance in the EU region
**And** all evidence blobs are stored in the Cloud Storage bucket in the EU region
**And** no tenant data crosses to a non-EU region without explicit customer consent

### Story 12.2: Multi-Business-Unit Configuration

As a Scale tier Org Admin,
I want to configure independent framework settings and user pools for multiple business units within our single tenant,
So that different divisions can manage their own compliance obligations without seeing each other's data.

**Acceptance Criteria:**

**Given** a Scale tier Org Admin navigates to Settings → Business Units
**When** the BU management page loads
**Then** they can create, rename, and deactivate business units
**And** each BU has its own: active frameworks, user pool, and dashboard view

**Given** a user is assigned to a specific business unit
**When** they log in
**Then** they see only controls, evidence, audits, and findings scoped to their assigned BU
**And** an Org Admin can view an aggregate cross-BU dashboard showing health across all BUs

**Given** a control is shared across multiple BUs
**When** the control is viewed
**Then** each BU maintains its own evidence and health status for that control independently
**And** the `business_unit_id` column (nullable since Epic 1) is populated for all BU-scoped records

### Story 12.3: BYOK Encryption for Scale Tier

As a Scale tier customer,
I want to supply my own encryption keys for data at rest,
So that I maintain custody of our encryption keys and can revoke platform access to our data at any time.

**Acceptance Criteria:**

**Given** a Scale tier Org Admin navigates to Settings → Encryption
**When** they provide a GCP Cloud KMS key resource ID or AWS KMS key ARN
**Then** a key validation step confirms the platform has the correct permissions before saving

**Given** a valid BYOK key is configured
**When** new tenant data is written
**Then** the tenant's BYOK key is used for envelope encryption via GCP Secret Manager
**And** the platform's default key is no longer used for this tenant's data

**Given** a Scale tier customer revokes their BYOK key
**When** the key is revoked in their KMS
**Then** the platform can no longer decrypt the tenant's data
**And** an alert is raised to both the customer and the platform operations team immediately

---

## Epic 13: Living Control Canvas *(Growth)*

Growth tier users navigate a Figma-style infinite canvas showing control relationships with domain groupings and AI gap highlighting; a mandatory fully WCAG 2.1 AA compliant 2D list fallback is always available.

### Story 13.1: React Flow Canvas Foundation — ControlNode, DomainGroup & 2D Fallback

As a Growth tier Audit Director,
I want to see my controls laid out on an infinite canvas with domain groupings,
So that I can understand relationships between controls spatially rather than in a flat list.

**Acceptance Criteria:**

**Given** a Growth tier Audit Director navigates to `/controls/canvas`
**When** the canvas loads
**Then** the React Flow v12 module is loaded via `next/dynamic` with `ssr: false` — never part of the main app bundle
**And** `ControlNode` components render for each control showing: status dot, control name, `FrameworkBadge`(s), and evidence indicator
**And** `DomainGroup` React Flow GroupNodes cluster controls by domain with the domain name and aggregate pass rate

**Given** the canvas module fails to load or a performance budget breach is detected
**When** the failure occurs
**Then** the view falls back automatically to the standard 2D `/controls` list view
**And** a banner appears: "Switch to accessible list view (F)" that is keyboard-accessible

**Given** a user opens the canvas for the first time
**When** the initial render completes
**Then** a 30-second guided tour overlay appears highlighting: how to zoom, how to click a control to open its `SidePanel`, and how to press F to switch to the list view
**And** the tour is skippable and never shown again after completion

### Story 13.2: Risk Edges, Canvas Navigation & AI Gap Highlighting

As a Growth tier Audit Director,
I want to see risk relationships between controls as edges and have AI highlight gaps on the canvas,
So that I can identify systemic weaknesses in my control framework at a glance.

**Acceptance Criteria:**

**Given** the canvas is loaded with controls and risks linked to multiple controls
**When** the canvas renders
**Then** `RiskEdge` components draw animated SVG edges between linked controls with the risk score label at the midpoint
**And** dashed edges indicate low-score risks; solid edges indicate high-score risks

**Given** an Audit Director clicks "Highlight gaps" on the canvas toolbar
**When** the AI gap analysis runs
**Then** controls with no evidence or failing status are highlighted with an amber/red glow
**And** a sidebar panel lists the top 5 gap clusters by domain with remediation suggestions

**Given** an Audit Director clicks on a `ControlNode` on the canvas
**When** the click fires
**Then** the `SidePanel` slides in from the right — the canvas remains visible and pannable behind it
**And** closing the `SidePanel` returns focus to the clicked `ControlNode`

---

## Epic 14: GRC Time Machine *(Vision)*

Users scrub through historical control environment states (data collected since Epic 1 via `control_health_snapshots`) and run AI-powered counterfactual scenario simulations — moving compliance from backward-looking documentation to forward-looking risk modelling.

### Story 14.1: Historical Control State Timeline

As an Audit Director,
I want to scrub through a timeline of my historical control environment states,
So that I can understand how our compliance posture has evolved and identify when specific gaps appeared.

**Acceptance Criteria:**

**Given** an Audit Director navigates to `/risk/time-machine`
**When** the timeline view loads
**Then** a horizontal scrubber renders showing the full date range from the tenant's earliest `control_health_snapshots` record to today
**And** dragging the scrubber to any date renders the dashboard and control list as they existed at that point in time (read-only)

**Given** the user scrubs to a historical date
**When** the historical state renders
**Then** all `ControlCard` components, `HealthSummaryBar` values, and trajectory score reflect the state at that date
**And** a banner clearly labels the view: "Viewing historical state: [date] — read-only"
**And** no actions (assign, upload, generate report) are available in historical mode

**Given** the user clicks on a specific control in historical mode
**When** the `SidePanel` opens
**Then** the evidence list and status reflect the state at the selected date
**And** a timeline mini-chart on the control detail shows the control's health history from activation to today

### Story 14.2: AI Counterfactual Scenario Simulation

As an Audit Director,
I want to run AI-powered counterfactual simulations on historical states,
So that I can understand what our risk exposure would have been if specific controls had failed or gaps had not been addressed.

**Acceptance Criteria:**

**Given** a user is viewing a historical state on the time machine
**When** they click "Run simulation"
**Then** they can select a scenario: "What if [control] had not been remediated by [date]?" or "What if [integration] had failed for 30 days?"
**And** an async job is enqueued using `claude-opus-4-7`

**Given** the simulation job completes
**When** results are shown
**Then** the simulated state is overlaid on the historical timeline as a dotted alternative path
**And** results show: estimated trajectory score impact, controls that would have degraded, and estimated audit finding count
**And** all simulation results carry a prominent disclaimer: "AI simulation — not a legal or audit opinion. Results are illustrative only."

**Given** a user exports a simulation result
**When** they click "Export simulation"
**Then** a PDF is generated containing the scenario definition, assumptions, simulated outcome, and the AI disclaimer
**And** the export is logged to `platform_audit_logs` with the scenario parameters
