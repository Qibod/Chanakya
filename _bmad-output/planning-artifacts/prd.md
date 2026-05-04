---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
releaseMode: phased
inputDocuments:
  - '_bmad-output/planning-artifacts/research/domain-grc-platform-smb-midmarket-audit-risk-research-2026-05-03.md'
  - '_bmad-output/planning-artifacts/research/market-grc-platform-buyers-pricing-gtm-smb-midmarket-research-2026-05-03.md'
  - '/Users/vijayraghavendar/Documents/GRC/Key features in the GRC tool.md'
workflowType: 'prd'
researchCount: 2
briefCount: 0
projectDocsCount: 0
ideasCount: 1
classification:
  projectType: saas_b2b
  domain: grc_regtech
  complexity: high
  projectContext: greenfield
---

# Product Requirements Document - GRC

**Author:** Vijay
**Date:** 2026-05-03

## Executive Summary

**[Product name TBD]** is a greenfield AI-native GRC (Governance, Risk & Compliance) SaaS platform targeting SMBs and mid-market organizations globally. It replaces the incumbent model — expensive, consultant-dependent tools on annual contracts ($50k–$300k/year, 6-month implementations) — with a self-serve, monthly subscription platform starting at $299/month that delivers enterprise-grade audit, risk, and compliance without implementation overhead.

The platform covers five compliance frameworks at initial release: SOC 2, ISO 27001, SOX, GDPR, and NIST CSF. Target segments are organizations with 50–2,500 employees that face regulatory scrutiny but cannot absorb legacy GRC procurement cycles. Primary buyer personas: Security-Conscious Founders/CTOs at Series B+ startups, Compliance-Driven COOs at growth-stage companies, Internal Audit Directors at mid-market firms, and IT/Risk Managers navigating multi-framework obligations.

The product addresses three compounding problems: (1) GRC tooling is artificially complex — designed to require consultants, not because the underlying problem demands it; (2) evidence collection remains manual and periodic, creating compliance theater rather than real control assurance; (3) the UX in every existing tool is a decade behind modern SaaS standards, reducing adoption and audit quality.

### What Makes This Special

**Design as a competitive moat.** Every GRC tool looks like enterprise software from 2003. This product treats design as a first-order differentiator — Apple-grade typography, Figma-inspired collaborative canvas, and interaction patterns that make compliance feel like a modern product rather than an audit obligation.

**AI as the operating model, not a feature.** AI is embedded at every layer: at onboarding, the platform fingerprints the company (industry, org structure, business processes, risk domains, regulatory obligations) by analyzing public filings, APQC frameworks, and LinkedIn signals — zero manual setup. During operation, AI agents continuously collect evidence via API integrations (Okta, AWS, Salesforce, Jira), monitor control health in real time, ingest regulatory change signals, and draft board-ready audit reports on demand.

**Continuous assurance over point-in-time audits.** Controls are monitored via a live "control pulse" — real-time health signals updated through automated integrations. This replaces annual audit cycles with continuous compliance posture, reducing both audit preparation cost and residual risk between assessments.

**Pricing disruption.** Monthly subscriptions at $299 (Starter), $799 (Growth), and $1,999 (Scale) against incumbents charging $50k–$300k annually. No annual lock-in. Self-serve onboarding. This price point is structurally impossible for incumbents to match without destroying their business model.

**Why now:** AuditBoard's $3B+ Hg acquisition has accelerated its exit from mid-market. IIA 2025 Global Internal Audit Standards now explicitly mandate AI/analytics in audit practice (Standard 10.3, effective January 2025). Regulatory surface area is expanding globally. The window to establish a modern GRC standard is open.

## Project Classification

- **Project Type:** SaaS B2B — multi-tenant platform, subscription tiers, RBAC, API integrations
- **Domain:** GRC / RegTech — SOC 2, ISO 27001, SOX, GDPR, NIST CSF
- **Complexity:** High — multi-framework compliance logic, AI multi-agent architecture, continuous monitoring, real-time integrations
- **Project Context:** Greenfield

## Success Criteria

### User Success

- New customers map their first compliance framework and see auto-populated controls within 1 business day of signup — no implementation consultant, no professional services engagement
- Automated evidence collection replaces >80% of manual evidence gathering within the first full audit cycle
- Control owners (stakeholders) complete assigned actions without requiring training, documentation, or support tickets — plain-language nudges only
- Audit report generated in under 60 seconds after audit close, producing a board-ready, exportable document

### Business Success

- **Year 1:** 100 paying customers; $500k ARR
- **Monthly churn:** ≤2% — compliance workflow stickiness and continuous monitoring dependency are the retention mechanism
- **NPS:** ≥60 — benchmark against legacy GRC tools (~20 NPS average) and modern compliance automation peers (Vanta ~60–70)
- **Self-serve conversion:** SMB tier converts from free trial to paid without sales-assisted touchpoint

### Technical Success

- AI company fingerprinting correctly identifies industry, org structure, and primary regulatory obligations for ≥90% of onboarding companies
- API integrations (Okta, AWS, Salesforce, Jira) maintain ≥99.5% uptime and evidence sync latency under 5 minutes
- Platform uptime ≥99.9% — compliance tooling outages directly impact customer audit timelines
- Audit report generation consistently completes in <60 seconds regardless of evidence volume

### Measurable Outcomes

| Outcome | Metric | Target |
|---|---|---|
| Time-to-value | Days from signup to first framework mapped | ≤1 business day |
| Evidence automation | % of evidence collected without manual upload | ≥80% |
| Retention | Monthly churn rate | ≤2% |
| Customer satisfaction | NPS | ≥60 |
| Revenue | ARR at end of Year 1 | $500k |
| Customer base | Paying customers at end of Year 1 | 100 |
| Audit efficiency | Time to generate final audit report | <60 seconds |

## User Journeys

### Journey 1: The Founder Chasing the Enterprise Deal
**Persona: Priya, CTO at a 65-person Series B SaaS startup**

Priya's sales team just lost a Fortune 500 deal because procurement asked for a SOC 2 Type II report and she had nothing to show. Her board wants enterprise revenue; enterprise buyers want compliance proof. She's been quoted $180,000 and 8 months by a Big 4 consulting firm.

She finds the platform through a Google search at 11pm. She signs up for Starter tier ($299/mo) and types "Acme Software" into the onboarding screen. Within 90 seconds, the AI has mapped Acme's industry (B2B SaaS), identified its cloud infrastructure (AWS, detected from public job listings), flagged the likely regulatory obligation (SOC 2 Type II for enterprise sales), and pre-populated a control framework with 73 controls — 41 already auto-mapped to her existing tooling.

She connects Okta and AWS in 20 minutes. The compliance dashboard lights up: 41 controls green, 32 need attention. She assigns the remaining controls to her engineering lead with plain-language tasks ("Review and document your AWS IAM privilege access policy"). No training needed.

Eight months later, her external auditor receives the evidence package assembled automatically by the platform. SOC 2 Type II issued. The enterprise deal closes. The platform cost her $2,400 over the audit cycle — saving $177,600 against the Big 4 quote.

**Capabilities revealed:** AI onboarding fingerprinting, framework auto-mapping, integration-based evidence collection, stakeholder task assignment, audit-ready evidence packaging.

---

### Journey 2: The Audit Director Modernizing a Legacy Program
**Persona: Marcus, Internal Audit Director at a 900-person financial services firm**

Marcus runs a 4-person audit team covering SOX, ISO 27001, and GDPR simultaneously. His current process: spreadsheets for control tracking, SharePoint for evidence, a Word template for audit reports. His last audit report took 3 weeks to produce. His board audit committee wants quarterly updates; he struggles to produce monthly ones.

He migrates to the Growth tier ($799/mo). The AI fingerprints the organization, maps all three frameworks against the unified control library, and surfaces that 68% of controls are shared across SOX/ISO/GDPR — meaning his team no longer manages them three times over.

He opens the compliance dashboard before his Monday standup. Every control has a live health pulse: green (tested and passing via API), amber (evidence stale >30 days), red (integration failure detected). His team spends the standup on red items only — everything else is running on autopilot.

At quarter close, he types "Generate Q3 board report" into the audit co-pilot. It pulls all workpapers, formats findings by severity, cross-references the prior quarter's action items, and produces a 14-page board-ready PDF in 47 seconds. He reviews, makes two edits, and emails it to the audit committee. His team's prep time drops from 3 weeks to 4 hours per quarter.

**Capabilities revealed:** Multi-framework unified control library, continuous control pulse, real-time dashboard, conversational audit co-pilot, one-tap report generation.

---

### Journey 3: The Control Owner Who Hates Audit Season
**Persona: Dev, Engineering Lead at Priya's company**

Every year, Dev dreads audit season. Someone from compliance sends him a 47-row spreadsheet asking for screenshots, access logs, and policy documents — with a 2-week deadline, no context, and cryptic column headers.

This year is different. Dev receives a Slack notification: "You have 3 controls assigned. 2 are automated — nothing needed from you. 1 requires a brief review." He clicks through to his personal dashboard. One task: confirm the quarterly access review for AWS IAM. Plain language, no jargon, 15 minutes of work. He uploads the review document, marks it done.

He never touches a spreadsheet. Audit season ends. He gets a summary notification: "All 3 of your controls passed. Audit closed."

**Capabilities revealed:** Stakeholder accountability layer, plain-language task interface, automated evidence pre-population, notification integrations (Slack/email), minimal-friction control owner UX.

---

### Journey 4: The External Auditor Completing the Loop
**Persona: Sandra, Senior Manager at a mid-tier audit firm**

Sandra is the lead auditor on Marcus's ISO 27001 audit. Traditionally, she spends the first two weeks of fieldwork chasing evidence requests via email. By the time evidence arrives, half of it is in the wrong format or missing metadata.

Marcus invites her to the Auditor Portal. Sandra logs in and sees a structured evidence room: every control mapped, every piece of evidence tagged with its source integration, timestamp, and collection method. She can filter by control domain, download evidence packages by framework section, and leave inline comments directly on evidence items.

She flags two items as insufficient. Marcus sees the flags in his dashboard immediately. The gaps are resolved within 48 hours — no email chain, no version confusion. Fieldwork time drops by 40%.

**Capabilities revealed:** External auditor access portal, evidence room with structured navigation, inline review and comment workflow, bidirectional flag/resolution flow.

---

### Journey 5: The Platform Admin Managing the Instance
**Persona: Carlos, IT/Security Manager, mid-market company, Scale tier**

Carlos is responsible for configuring and maintaining the GRC platform for a 1,200-person company. He manages user provisioning (SSO via Okta), integration health, and framework configuration across three business units with different compliance obligations.

He uses the admin console to provision 47 control owners via SCIM sync from Okta — zero manual account creation. He configures which frameworks apply to which business unit. When an AWS integration silently starts failing (API credential rotation), he receives an alert before any control falls out of evidence coverage. He rotates the credential and the integration resumes — no controls turn red, no audit gap created.

He sets a quarterly review cadence on a set of high-risk controls, with automatic escalation to the CISO if controls remain amber for more than 7 days. Everything is configured through the admin UI, no code required.

**Capabilities revealed:** SSO/SCIM provisioning, multi-tenant business unit configuration, integration health monitoring and alerting, automated escalation rules, admin console.

---

### Journey 6: The Developer Integrating via API
**Persona: Aisha, DevOps Engineer building a custom integration**

Aisha's company uses a proprietary ITSM tool not in the platform's native integration library. She needs to push ticket closure events into the platform as evidence for change management controls.

She accesses the developer portal, reads the REST API documentation, and uses a webhook endpoint to push structured evidence payloads from the ITSM tool. The platform validates the payload schema, maps it to the correct control, and surfaces it in the evidence room with correct timestamps. She sets up the integration in an afternoon using a sample payload from the docs.

**Capabilities revealed:** Public REST API for evidence ingestion, webhook endpoints, developer documentation, payload schema validation, API key management.

---

### Journey Requirements Summary

| Journey | Key Capabilities Required |
|---|---|
| Founder (Priya) | AI fingerprinting, framework mapping, integration connectors, stakeholder task assignment, evidence packaging |
| Audit Director (Marcus) | Unified control library, continuous monitoring, compliance dashboard, co-pilot, one-tap reports |
| Control Owner (Dev) | Stakeholder dashboard, plain-language tasks, Slack/email notifications, minimal-friction UX |
| External Auditor (Sandra) | Auditor portal, evidence room, inline review, bidirectional flag workflow |
| Platform Admin (Carlos) | SSO/SCIM, multi-BU config, integration alerting, escalation rules, admin console |
| Developer (Aisha) | REST API, webhooks, developer docs, schema validation, API key management |

## Domain-Specific Requirements

### Compliance & Regulatory

**The platform must model these frameworks accurately:**

- **SOC 2** — Trust Service Criteria (Security, Availability, Processing Integrity, Confidentiality, Privacy); supports Type I (design) and Type II (operating effectiveness over a period); evidence must include timestamps, collection source, and methodology
- **ISO 27001:2022** — Annex A controls (93 controls across 4 domains), Statement of Applicability (SoA) as a mandatory output, ISMS documentation requirements, management review records
- **SOX** — Section 302/404 controls, Internal Control over Financial Reporting (ICFR), segregation of duties enforcement, evidence retention minimum 7 years, management assertion documentation
- **GDPR** — Article 32 technical and organizational measures, Records of Processing Activities (ROPA), Data Processing Agreements (DPAs), right to erasure implications for evidence retention conflicts, data residency requirements for EU customers
- **NIST CSF 2.0** — Six functions (Govern, Identify, Protect, Detect, Respond, Recover); subcategory mapping to controls; tier and profile tracking

**The platform itself must achieve:**
- SOC 2 Type II certification before targeting mid-market — customers will ask for it as a vendor due diligence requirement
- GDPR compliance for all EU customer data processing
- ISO 27001 certification is a growth-stage milestone (credibility with enterprise buyers)

### Technical Constraints

- **Evidence immutability** — all collected evidence must be cryptographically hashed and write-once; no modification or deletion after collection; customers' external auditors depend on evidence integrity
- **Audit trail** — every platform action (evidence upload, control status change, user assignment, report generation) logged with actor, timestamp, and IP; logs must be tamper-evident and exportable
- **Data isolation** — strict multi-tenant data separation; no cross-tenant data leakage at query, storage, or caching layer; SOC 2 Trust Services Criteria require demonstrable tenant isolation
- **Encryption** — AES-256 at rest, TLS 1.3 in transit; customer encryption key management (BYOK) required for Scale tier
- **Data retention** — configurable retention policies by framework: SOX evidence minimum 7 years; GDPR data minimization conflicts with SOX retention must be surfaced and resolved per customer policy
- **Data residency** — EU customers require data stored in EU regions (AWS eu-west, eu-central); configurable at tenant provisioning

### Integration Requirements

- **Authentication:** SAML 2.0 and OIDC for SSO; SCIM 2.0 for automated user provisioning/deprovisioning
- **Native connectors (MVP):** Okta (identity), AWS (cloud infrastructure), Salesforce (CRM/data), Jira (change management/ticketing)
- **Native connectors (Growth):** GitHub, Azure AD, GCP, Workday, ServiceNow, Slack, Microsoft 365
- **Evidence ingestion API:** REST API + webhooks for custom/proprietary system integrations; structured payload schema with control mapping
- **Export formats:** Evidence packages as PDF, ZIP (raw files + metadata), JSON (structured data); audit reports as PDF and interactive HTML; all exports include chain-of-custody metadata
- **External auditor access:** Read-only scoped portal access; no Anthropic/platform credentials required; time-limited access tokens; access logged for audit purposes

### Risk Mitigations

| Risk | Mitigation |
|---|---|
| Evidence tampering compromises audit validity | Cryptographic hash on ingest; immutable storage; hash verification on export |
| AI-generated findings accepted without review | All AI-drafted content clearly labeled; human review required before finalizing findings or reports |
| False compliance (gaps hidden by automation) | Platform surfaces amber/red controls prominently; never auto-resolves a control without evidence; gap visibility is a core design principle |
| Customer data breach (platform holds sensitive compliance data) | SOC 2 Type II self-certification; penetration testing cadence; CSPM tooling; responsible disclosure program |
| Vendor lock-in concern blocking enterprise sales | Full data export at any time (controls, evidence, audit history, reports); no proprietary formats |
| Evidence retention vs. GDPR erasure conflict | Explicit conflict surfacing in UI when erasure request affects SOX/SOC 2 evidence; customer must make the policy decision with documented rationale |
| LinkedIn/public data use at onboarding | Transparent disclosure of data sources used; customer can override or exclude any AI-inferred data before it enters the system |

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. AI-Native Onboarding — Zero Setup Compliance**
No GRC tool performs autonomous company fingerprinting at signup. The current paradigm requires 4–12 weeks of consultant-led setup to map an organization's controls, processes, and frameworks. This product eliminates that entirely: type a company name and the AI infers industry, org structure, business processes, risk domains, and regulatory obligations from public sources (SEC/Companies House filings, APQC process frameworks, LinkedIn org signals) — then pre-populates the control framework. The "aha" moment arrives before the user has done any work.

**2. Continuous Control Monitoring — From Annual Audits to Living Assurance**
The audit industry is built on a point-in-time model: evidence is gathered, tested once per year, and the result is a compliance certificate that is stale the moment it's issued. This platform replaces that model with continuous evidence collection via API integrations — controls are tested in near real-time, not annually. The "control pulse" metaphor (ECG for your control environment) communicates this shift clearly. No competitor in the SMB/mid-market segment has built this as a native capability.

**3. Design as a Primary Differentiator in a Design-Blind Category**
GRC software has never competed on design. Every incumbent treats UI as a cost, not a capability. Introducing Apple-grade typography, a Figma-style collaborative canvas, and interaction patterns borrowed from modern SaaS (not enterprise software) is genuinely novel for this domain. Design becomes a moat because incumbents cannot improve their UX without rebuilding their products from scratch.

**4. Pricing Architecture That Incumbents Cannot Match**
Monthly subscriptions at $299–$1,999 in a market where the floor is $50k/year is not just a pricing decision — it's a structural disruption. Incumbents (AuditBoard, LogicGate, ServiceNow GRC) have business models, sales motions, and cost structures that make matching this pricing suicidal. The innovation is using modern SaaS infrastructure economics to deliver a price point that is literally impossible for legacy vendors to replicate without destroying their existing revenue.

**5. AI Simulation and Counterfactual Risk Analysis (Vision)**
The "GRC time machine" feature — scrubbing control history and running AI simulations ("what would our exposure look like if we hadn't addressed this gap?") — has no precedent in the GRC market. This moves compliance from backward-looking documentation to forward-looking risk modeling. It shifts the product's value proposition from "prove you were compliant" to "understand your risk trajectory."

**6. Immersive 3D Risk Terrain**
Replacing the flat 2D risk heat map — unchanged in GRC tools for 20 years — with a navigable 3D terrain where risk severity is expressed as landscape elevation. A genuinely novel interaction model for risk visualization that makes risk intuitive for non-audit stakeholders (boards, executives).

### Market Context & Competitive Landscape

- No existing SMB GRC tool offers AI fingerprinting, continuous monitoring, or sub-$1,000/mo pricing simultaneously
- Vanta and Drata offer compliance automation but are framework-narrow (primarily SOC 2) and lack internal audit, risk management, and multi-framework cross-mapping
- AuditBoard and LogicGate offer depth but at enterprise price points ($50k+) with consultant-dependent setup
- The combination of full-stack GRC + AI-native + modern UX + monthly pricing has no direct analog in the market

### Validation Approach

| Innovation | Validation Method |
|---|---|
| AI fingerprinting accuracy | Beta test with 20 companies across 5 industries; measure % of controls correctly pre-populated vs. manual setup |
| Continuous monitoring value | A/B test: customers with live integrations vs. manual evidence; measure audit prep time reduction |
| Design differentiation | User testing vs. Vanta/Drata; measure task completion rate and time-on-task |
| Monthly pricing retention | Track Month 3 and Month 6 retention; churn ≤2% validates pricing doesn't create instability |
| 3D risk terrain comprehension | Usability testing with non-audit stakeholders; measure time-to-insight vs. traditional heat map |

### Risk Mitigation

| Innovation Risk | Mitigation |
|---|---|
| AI fingerprinting inaccurate for niche industries | User can review, edit, and override all AI-inferred data before it enters the system; graceful fallback to manual setup |
| Continuous monitoring creates alert fatigue | Control pulse uses green/amber/red with escalation thresholds; noise-filtered by severity |
| 3D visualization confuses non-technical users | 2D heat map available as fallback view; 3D is an opt-in enhancement |
| Monthly pricing attracts low-commitment customers who churn after audit | Onboarding emphasizes continuous monitoring value (not just audit prep); post-audit engagement features keep the platform relevant year-round |
| AI simulation results misinterpreted as guarantees | Clear labeling: "AI simulation — not a legal or audit opinion"; human review required before sharing externally |

## SaaS B2B Specific Requirements

### Project-Type Overview

A multi-tenant, subscription-based B2B SaaS platform serving organizations from 50 to 2,500+ employees. Each tenant is an independent organization with isolated data, framework configuration, user base, and integration connections. The platform scales from a single-founder startup on Starter tier to a 1,200-person company on Scale tier without architectural changes. Annual prepay is the default billing offer (10% discount); monthly billing available.

### Tenant Model

- **Multi-tenant architecture** — separate schema per tenant in a shared database; Row-Level Security (RLS) as a secondary enforcement layer; defense-in-depth isolation model
- **Scale tier** — dedicated schema with option for dedicated database on contract; data residency selection (US / EU) at provisioning; cannot be changed post-provisioning without migration workflow
- **Business unit segmentation** — Scale tier supports multiple business units within a single tenant, each with independent framework configuration, user pools, and dashboards
- **Tenant offboarding** — full data export on cancellation; data purged within 30 days; export includes controls, evidence, audit history, reports, and all metadata
- **Automated cross-tenant isolation testing** — regression tests verifying no cross-tenant data access run on every deployment; pre-GA third-party penetration test with explicit cross-tenant isolation scope required

### RBAC Matrix

| Role | Scope | Key Permissions |
|---|---|---|
| **Organization Admin** | Tenant-wide | Full access; user management; billing; integration configuration; framework setup; SCIM group-to-role rule configuration |
| **Audit Director / GRC Manager** | Tenant-wide | Create/manage audits; assign controls; view all dashboards; generate reports; manage framework mapping; issue/revoke external auditor tokens |
| **Control Owner** | Assigned controls only | View assigned controls; upload evidence; mark tasks complete; view own compliance status; receive AI-generated context-aware task instructions |
| **Read-Only Stakeholder** | Configurable scope | View dashboards, reports, and control status; no edit capabilities |
| **Board / Executive Portal** | Configurable scope | Magic-link or SSO access to compliance trajectory score, open findings count, and trend view; no operational access; no login friction |
| **External Auditor** | Scoped evidence room (time-limited) | Read-only access to specific audit evidence room; inline commenting; control flagging; per-control conversation thread; time-limited UUID token |
| **Developer / API User** | API scope only | Evidence ingestion; webhook management; API key management; sandbox environment access |
| **Super Admin (Platform)** | Platform-wide | Internal use only; all access logged |

- All permission checks server-side; client-side UI hides inaccessible features but server enforces authorization on every request — client-supplied role or tier claims are never trusted
- SCIM group-to-role mapping: admin-configurable rules mapping IdP groups (Okta, Azure AD) to platform roles per business unit — no-code, no engineer required
- SCIM deprovisioning triggers immediate session invalidation across all active tokens

### Subscription Tiers

| Feature | Starter ($299/mo) | Growth ($799/mo) | Scale ($1,999/mo) |
|---|---|---|---|
| Frameworks | 1 active + preview of others | Up to 3 | Unlimited |
| Users | Up to 10 | Up to 50 | Unlimited |
| Control owners | Up to 25 | Up to 150 | Unlimited |
| Evidence storage | 5 GB (overage: $5/GB) | 25 GB | 100 GB+ |
| AI co-pilot queries | 50/month | 250/month | Unlimited (fair use) |
| Native integrations | 4 | 10 | All + custom API |
| Business units | 1 | 1 | Multiple |
| External auditor access | — | ✓ | ✓ |
| SSO / SCIM | — | ✓ | ✓ |
| SCIM group-to-role mapping | — | ✓ | ✓ |
| Board / executive portal | — | ✓ | ✓ |
| BYOK encryption | — | — | ✓ |
| Data residency choice | — | — | ✓ |
| Dedicated schema / DB | — | — | ✓ |
| SLA | 99.5% | 99.9% | 99.9% + dedicated support |
| Support | Async only (email/chat bot) | Live chat + email | Dedicated CSM |
| Annual prepay discount | 10% ($3,232/yr) | 10% ($8,628/yr) | 10% ($21,588/yr) |

**Framework preview on Starter:** Starter customers see a read-only gap assessment for locked frameworks showing control count and estimated gaps — drives organic Growth conversion without a sales call.

**Year 1 target tier mix:** 70 Starter / 25 Growth / 5 Scale = ~$546k ARR at annual prepay rates.

### Business Model & Moat

**GTM motion per tier:**
- Starter: Fully PLG — content/SEO, product virality, 14-day free trial, credit card at conversion; estimated CAC ~$250, payback ~1 month
- Growth: Trial-assist — SDR outreach after 7-day trial engagement, AE closes; estimated CAC ~$2,500, payback ~3 months
- Scale: Outbound + partner-led (MSPs, audit firms); estimated CAC ~$10,000, payback ~5 months

**Retention moat — evidence corpus strategy:**
- The evidence chain is the primary defensibility layer: once a customer has 12+ months of immutable, timestamped evidence and audit history, migration cost is prohibitive
- Cross-cycle comparative reporting ("Your SOC 2 control health improved 23% year-over-year") makes historical data visible and valuable
- Compliance trajectory score — a rolling health indicator updated continuously, visible to executives and board; once embedded in board reporting cadence, cancellation requires actively removing it
- GRC time machine (Year 2 milestone): data model built from day one; UI delivered when customers have sufficient history
- Full data export always available — customers who know they can leave but choose not to become advocates

### Integration Catalog

**MVP (all tiers):** Okta, AWS, Salesforce, Jira

**Growth tier additions:** GitHub/GitLab, Azure AD, GCP, Slack, Workday, ServiceNow, Microsoft 365

**Integration connectivity model:**
- Webhooks/event streaming as primary for supported integrations; scheduled polling (default 4h, configurable) as universal fallback
- "Last synced" timestamp visible on every evidence item — evidence freshness is always transparent
- Integration health dashboard: connected / degraded / failed status per integration
- **Integration failure SLA:** detection ≤1 hour; customer notification ≤4 hours via email + in-app; evidence staleness beyond threshold automatically downgrades affected controls from green → amber → red; control owner and org admin notified

**Custom integration (all tiers):** REST API + webhook endpoint; structured payload schema; API key authentication; developer sandbox environment (isolated non-production tenant, separate credentials, evidence never enters audit records)

**Credential security:** Integration credentials encrypted at rest with tenant-specific keys in secrets manager (not application database); least-privilege integration scopes documented in UI; refresh token rotation on every use; anomalous usage triggers revocation and admin alert

### Evidence Architecture

- **Immutability model** — immutable evidence blobs in object storage with SHA-256 hash on ingest; write-once enforced at storage layer; deduplication via content hash before write
- **Separate mutable metadata record** per evidence item: control mapping, auditor flags, review status, conversation thread; hash verification on export
- **Evidence versioning** — single canonical "current evidence" designation per control; previous versions archived and accessible but clearly subordinate
- **Per-control conversation thread** — auditor comment → client response → re-upload → resolution; threaded, not a flat file list
- **AI and evidence security** — evidence files never passed as raw text to the LLM; structured metadata extraction pipeline only; injection guard active on co-pilot file analysis; all AI-analyzed content flagged for human review

### AI Architecture

- **Hybrid model** — synchronous LLM calls for co-pilot queries (<5s); async job queue for report generation, fingerprinting, and batch processing; progress state + notification on completion
- **AI fingerprinting** — results presented as "suggested starting point" with source attribution per suggestion; confidence tier per suggestion: High (pre-selected) / Medium (confirm required) / Low (opt-in); all results require explicit user confirmation before entering the control framework
- **AI-generated control owner task instructions** — dynamic, context-aware step-by-step guidance generated at assignment time; tailored to connected integrations; updated when integration configuration changes

### Technical Architecture

- **Frontend** — Next.js with hybrid rendering: SSR for public/marketing/login/onboarding; SPA for authenticated app shell; canvas-heavy features (living control canvas, 3D terrain) built as isolated modules with performance budgets and 2D fallback for low-powered devices
- **Backend** — REST API with webhook support; event-driven architecture for continuous monitoring pipeline; async job queue for AI workloads
- **Multi-tenancy** — schema-per-tenant with RLS as secondary layer; tenant ID enforced on every query; no shared caches; automated regression tests on every deployment
- **Tier enforcement** — strictly server-side on every API request; client-side tier display is decorative only
- **Observability** — full audit logging of all platform actions (actor, timestamp, IP, action, resource); tamper-evident; tenant-scoped log export for Scale tier

### Implementation Considerations

- SOC 2 Type II self-certification is a launch prerequisite for mid-market sales — build to it from day one
- Pre-GA: third-party penetration test required covering cross-tenant isolation, RBAC bypass, evidence tampering, and credential theft scenarios
- EU data residency must be operational before any EU marketing begins
- Post-certification engagement features (weekly compliance digest, regulatory change alerts, compliance trajectory score) are MVP-critical — primary retention mechanism against seasonal churn
- Framework completeness indicator visible on all framework views; pre-audit sign-off checklist required before opening an audit; all report output includes disclaimer: "Generated with AI assistance — not a substitute for a qualified auditor"
- Annual prepay as default billing offer from day one — improves cash flow, reduces seasonal churn, supports payback period targets

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience MVP — the first release must be demonstrably better than spreadsheets and legacy tools on both design and automation, not just feature-complete. A user who onboards, maps their first framework, and sees evidence auto-collected within one business day has experienced the core value proposition. Everything else is depth.

**Resource Requirements:** Estimated minimum team to ship MVP — 2 senior full-stack engineers, 1 frontend engineer (design-systems capable), 1 AI/ML engineer, 1 product designer, 1 founder/PM. Infrastructure: AWS, Next.js, PostgreSQL (schema-per-tenant), async job queue (SQS or similar), object storage (S3 with object lock).

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:** Priya (founder), Marcus (audit director), Dev (control owner), Carlos (platform admin — basic), Aisha (developer/API)

**Must-Have Capabilities:**

*Onboarding & Setup*
- AI company fingerprinting: industry, org structure, business processes, risk domains, regulatory obligations inferred from public sources; confidence scoring with source attribution; explicit user confirmation before data enters system
- Framework library: SOC 2, ISO 27001, SOX, GDPR, NIST CSF
- Unified control library with cross-framework mapping (~70% overlap surfaced automatically)
- Framework preview on Starter: read-only gap assessment for locked frameworks to drive Growth conversion
- In-app onboarding checklist with progress tracking; contextual help embedded in UI

*Compliance Operations*
- Compliance dashboard: real-time control health (green/amber/red), gap tracking, remediation status
- Evidence collection via native integrations: Okta, AWS, Salesforce, Jira
- Webhooks-first connectivity; polling fallback (4h default); "last synced" timestamp on all evidence
- Integration health dashboard; failure SLA: detection ≤1h, notification ≤4h; automatic control degradation on staleness
- Immutable evidence storage: SHA-256 hash on ingest, write-once object storage, mutable metadata record separate
- Evidence versioning: canonical "current" per control, version history accessible
- Per-control conversation thread: auditor comment → client response → resolution

*AI & Automation*
- AI fingerprinting pipeline (async)
- AI-generated context-aware control owner task instructions (integration-aware, dynamic)
- One-tap audit report generation: board-ready PDF + interactive HTML; <60 second generation; AI-assistance disclaimer; pre-audit sign-off checklist

*Stakeholder & Access Management*
- Control owner dashboard: plain-language tasks, Slack/email notifications
- RBAC: Organization Admin, Audit Director, Control Owner, Read-Only Stakeholder roles
- SSO (SAML 2.0, OIDC) on Growth+; SCIM provisioning on Growth+; SCIM group-to-role mapping
- Multi-tenant isolation: schema-per-tenant + RLS; all permission checks server-side

*Post-Certification Engagement (MVP-critical for retention)*
- Weekly compliance digest email (automated)
- Regulatory change alerts: monitoring GDPR, ISO 27001, SOC 2, NIST updates
- Compliance trajectory score: rolling health indicator, visible to admins and executives

*Developer & API*
- REST API for evidence ingestion + webhook endpoints
- Developer sandbox environment (isolated non-production tenant)
- API key management

*Business*
- Subscription tiers: Starter ($299/mo), Growth ($799/mo), Scale ($1,999/mo)
- Annual prepay as default offer (10% discount)
- Self-serve onboarding for Starter and Growth; Starter: async support only
- Usage limits enforced per tier (evidence storage, AI queries, integrations)

*Security & Compliance*
- Pre-GA: third-party penetration test (cross-tenant isolation, RBAC bypass, evidence tampering)
- Automated cross-tenant regression tests on every deployment
- Integration credentials in secrets manager with tenant-specific encryption; least-privilege scopes
- Platform SOC 2 Type II certification process initiated at build start

### Growth Features (Phase 2)

**User Journeys Added:** Sandra (external auditor — full portal), Carlos (full multi-BU admin)

- Living control canvas — Figma-style infinite canvas with AI gap highlighting and real-time team collaboration
- Ambient risk radar — live signal feed mapping news, regulatory updates, and vendor breach alerts to your specific control framework
- Conversational audit co-pilot — NLP interface for querying audit status, drafting findings, surfacing anomalies in evidence
- Regulatory change agent — AI agent that auto-assesses regulatory change impact on your control framework and drafts action plans
- External auditor portal — scoped evidence room, inline review, per-control threads, time-limited UUID tokens, revocation endpoint
- Board / executive portal — magic-link or SSO access to compliance trajectory score and open findings; no operational access
- Expanded integrations: GitHub/GitLab, Azure AD, GCP, Slack, Workday, ServiceNow, Microsoft 365
- Multi-BU configuration for Scale tier: independent framework config and user pools per business unit
- BYOK encryption for Scale tier
- EU data residency for GDPR-required customers
- Dedicated schema / DB option for Scale tier
- Platform ISO 27001 certification (credibility with enterprise buyers)

### Vision (Phase 3)

- GRC time machine — full control environment history scrub with AI simulation and counterfactual risk analysis
- Pre-audit stress testing and scenario modelling
- 3D immersive risk terrain — navigable landscape replacing flat 2D heat maps
- Full agentic evidence collection — zero human touchpoints in evidence pipeline
- Multi-language support for global mid-market expansion
- Auditor firm portal — multi-client management for external audit firms

### Risk Mitigation Strategy

**Technical Risks**
- *AI fingerprinting accuracy*: Beta with 20 companies across 5 industries before GA; confidence scoring + user confirmation prevents bad data from entering the system; manual setup always available as fallback
- *Immutable evidence pipeline*: Build and load-test before first paying customer; evidence integrity is non-negotiable — a single integrity failure destroys trust
- *Canvas and 3D features (Growth/Vision)*: Performance-budget as isolated modules with 2D fallback; test on mid-range hardware early; defer if performance bar not met

**Market Risks**
- *Seasonal churn*: Post-certification engagement features (digest, alerts, trajectory score) are MVP to retain customers beyond audit season; monitor Month 3 and Month 6 retention as leading indicators
- *AI fingerprinting erodes trust*: Confidence scoring and source attribution are MVP — users must see the AI's reasoning, not just its output; feedback loop built from day one
- *Competitor response*: Vanta/Drata can add risk management; they cannot match the design bar or monthly pricing without rebuilding and repricing — 18-month window to establish brand

**Resource Risks**
- *Minimum viable team*: 6 people (2 full-stack, 1 frontend, 1 AI/ML, 1 designer, 1 PM/founder); below this, defer Growth features entirely and ship a leaner MVP
- *If resources constrained*: Cut co-pilot and 3D terrain first; keep fingerprinting, continuous monitoring, and report generation — these are the core value proposition
- *Scope creep protection*: Growth features locked behind Phase 2; any request to pull Growth features into MVP requires explicit scope change decision with trade-off analysis

## Functional Requirements

### Onboarding & Company Intelligence

- **FR1:** New users can initiate AI-powered company fingerprinting by entering a company name to auto-populate industry classification, org structure, business processes, risk domains, and regulatory obligations
- **FR2:** Users can review AI-inferred company data with confidence indicators (High / Medium / Low) and source attribution per data point before committing it to the system
- **FR3:** Users can override, edit, or exclude any AI-inferred data point before it enters the control framework
- **FR4:** Users can complete initial platform setup through a guided onboarding checklist with progress tracking and contextual in-app help
- **FR5:** Starter tier users can view a read-only gap assessment and estimated control count for frameworks not included in their active subscription

### Compliance & Control Management

- **FR6:** Users can activate and configure compliance frameworks from the library: SOC 2, ISO 27001, SOX, GDPR, NIST CSF
- **FR7:** The system can automatically map controls across multiple active frameworks, surfacing shared controls to eliminate duplication
- **FR8:** Audit Directors can assign controls to specific control owners with AI-generated, integration-aware task instructions
- **FR9:** The system can automatically generate and update context-aware task instructions for each control assignment based on the organization's connected integrations
- **FR10:** Users can view a real-time compliance dashboard showing control health status (green / amber / red) across all active frameworks
- **FR11:** Users can track gap remediation progress and framework completion percentage at any time
- **FR12:** Audit Directors can create and manage audit engagements with defined scope, timeline, assigned controls, and sign-off requirements

### Evidence Management

- **FR13:** The system can automatically and continuously collect evidence from connected integrations
- **FR14:** Users can manually upload evidence files to specific controls
- **FR15:** The system preserves evidence immutability with cryptographic integrity verification on ingest and export
- **FR16:** Users can view version history for each control's evidence, with a single canonical "current" evidence designation per control
- **FR17:** Auditors and control owners can communicate through a per-control threaded conversation with comment, response, re-upload, and resolution states
- **FR18:** Users can view the source system and last-synced timestamp for every piece of collected evidence
- **FR19:** The system automatically degrades control health status when evidence becomes stale or integration connectivity fails

### Integration & Connectivity

- **FR20:** Users can connect and configure native integrations (Okta, AWS, Salesforce, Jira) through a no-code configuration interface
- **FR21:** Users can view real-time integration health status (connected / degraded / failed) for all connected systems
- **FR22:** Admins and control owners receive notifications when integration failures are detected within platform SLA windows
- **FR23:** Developers can ingest evidence from any system via REST API with structured payload schema and webhook endpoints
- **FR24:** Developers can test integrations against an isolated sandbox environment that does not affect production audit records
- **FR25:** Admins can configure evidence polling intervals for integrations that do not support event-driven connectivity

### Audit Management & Reporting

- **FR26:** Audit Directors can generate board-ready audit reports from completed audit workpapers in a single action
- **FR27:** Users can export audit reports as PDF and interactive HTML, both including chain-of-custody metadata
- **FR28:** Users can track open findings across audit cycles with owner, status, due date, and resolution history
- **FR29:** Audit Directors can require explicit scope sign-off confirmation before an audit is opened
- **FR30:** **(Growth)** Audit Directors can issue time-limited, scoped access tokens to external auditors for a specific audit's evidence room
- **FR31:** **(Growth)** External auditors can review evidence, flag insufficiencies, and leave inline comments within their scoped evidence room
- **FR32:** **(Growth)** Audit Directors can revoke external auditor access tokens at any time
- **FR33:** **(Growth)** Users can query audit status, draft findings, and surface evidence anomalies through a conversational AI co-pilot
- **FR53:** **(Growth)** Users can invoke contextual AI assistance inline on any control, risk, or evidence item — without leaving the current view — to get instant explanations, remediation suggestions, policy drafts, or audit finding templates

### Risk & Regulatory Intelligence

- **FR34:** Users can view a compliance trajectory score reflecting overall control health as a rolling indicator over time
- **FR35:** Users receive automated periodic compliance digest summaries surfacing health changes and upcoming obligations
- **FR36:** Users receive alerts when monitored regulatory bodies publish changes relevant to their active compliance frameworks
- **FR37:** Users can view a risk register with risks mapped to controls, owners, likelihood, impact, and remediation status
- **FR38:** **(Growth)** The system monitors external signals (news, regulatory updates, vendor breach alerts) and maps them to the user's active control framework in real time
- **FR39:** **(Growth)** An AI regulatory change agent assesses the impact of a detected regulatory change on the user's control framework and drafts a remediation action plan

### User & Access Management

- **FR40:** Organisation Admins can create, modify, and deactivate user accounts with role assignments
- **FR41:** Control owners can receive task notifications through configurable channels including email and messaging integrations
- **FR42:** **(Growth+)** Users can authenticate via SSO using SAML 2.0 or OIDC identity providers
- **FR43:** **(Growth+)** Admins can configure automated user provisioning and deprovisioning via SCIM
- **FR44:** **(Growth+)** Admins can configure group-to-role mapping rules that automatically assign platform roles based on identity provider group membership
- **FR45:** **(Growth+)** Board members and executives can access a read-only compliance status view via magic link or SSO without operational platform access

### Platform Administration & Developer Tools

- **FR46:** Organisation Admins can manage subscription tier, billing preferences, and view current usage against tier limits
- **FR47:** Admins can export all tenant data (controls, evidence, audit history, reports) in full at any time
- **FR48:** **(Scale)** Admins can select data residency region at tenant provisioning
- **FR49:** **(Growth)** Scale tier admins can configure independent framework settings and user pools for multiple business units within a single tenant
- **FR50:** Developers can manage API keys, webhook endpoints, and sandbox credentials through a developer portal
- **FR51:** Platform operators can access tamper-evident audit logs of all platform actions with actor, timestamp, and resource
- **FR52:** **(Vision)** Users can scrub through historical control environment states and run AI-powered counterfactual scenario simulations

## Non-Functional Requirements

### Performance

- Dashboard and control health views render within **2 seconds** under normal load (≤500 concurrent users per tenant)
- Evidence collected from integrations is reflected in control health status within **5 minutes** of a triggered webhook event; within **8 hours** of a scheduled poll cycle
- Audit report generation completes within **60 seconds** for audits with up to 500 evidence items
- REST API endpoints respond within **500ms** at the 95th percentile under normal load
- AI co-pilot synchronous query responses return within **5 seconds** at the 95th percentile
- Async AI jobs (report generation, fingerprinting) surface completion notification within **30 seconds** of job completion
- Platform onboarding fingerprinting completes within **90 seconds** of company name submission

### Security

- All data encrypted at rest using AES-256; all data in transit using TLS 1.3 minimum
- Scale tier customers can supply their own encryption keys (BYOK) for data at rest
- Evidence files stored in write-once object storage with SHA-256 integrity hash; hash verified on every export
- Third-party penetration test completed before general availability, covering: cross-tenant data isolation, RBAC privilege escalation, evidence tampering, external auditor token enumeration, and API credential abuse
- Automated cross-tenant isolation regression tests run on every production deployment; any failure blocks deployment
- Integration credentials stored in secrets manager (not application database); encrypted with tenant-specific keys
- Session tokens invalidated immediately on user deactivation or SCIM deprovisioning event
- External auditor access tokens are time-limited (default 30 days), scoped to specific audit IDs (UUID, non-enumerable), and revocable on demand
- All platform actions written to tamper-evident audit log with actor, timestamp, IP, and resource
- Platform achieves and maintains SOC 2 Type II certification; initiated at build start, completed before mid-market GTM launch

### Scalability

- Platform architecture supports **1,000 concurrent tenants** without degradation at MVP launch; designed to scale to **10,000 tenants** without schema changes
- Single tenant supports up to **500 concurrent users** without performance degradation below stated thresholds
- Evidence storage scales to **10TB** per tenant without architectural changes
- Integration polling infrastructure handles **100,000 evidence ingestion events per hour** across all tenants
- AI inference pipeline scales horizontally; no single-tenant job blocks or degrades processing for other tenants

### Reliability

- Platform uptime SLA: **99.5%** for Starter; **99.9%** for Growth and Scale (measured monthly, excluding scheduled maintenance)
- Recovery Time Objective (RTO): **4 hours** for Starter; **1 hour** for Growth and Scale
- Recovery Point Objective (RPO): **24 hours** for Starter; **1 hour** for Growth and Scale
- Evidence pipeline maintains **99.9% delivery reliability**; failed ingestion events retried with dead-letter queue and alerting
- Integration failure detected within **1 hour**; customer notified within **4 hours**
- Automated database backups every **6 hours**; retained for **30 days**; evidence object storage versioning enabled
- Zero-downtime deployments required for all production releases

### Accessibility

- All user-facing interfaces comply with **WCAG 2.1 Level AA**
- All interactive elements operable via keyboard navigation
- Screen reader compatibility for core workflows: compliance dashboard, control assignment, evidence upload, and report generation
- Colour is never the sole means of conveying control health status — status communicated through labels, icons, or text in addition to colour
- Canvas-based features (Growth/Vision) provide an accessible 2D fallback meeting WCAG 2.1 AA for all core operations

### Data & Compliance

- Customer data retained for subscription duration plus **30 days** post-cancellation; purged within 30 days of contract end with deletion confirmation
- SOX evidence retained minimum **7 years** per customer configuration; GDPR erasure conflicts with SOX retention surfaced explicitly for customer policy decision
- EU tenant data stored and processed exclusively within EU regions; no cross-region transfer without explicit customer consent
- Data minimisation applied to all AI inference inputs; platform processes no data beyond what is necessary for compliance monitoring
