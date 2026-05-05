// @grc/types — Single source of truth for all shared TypeScript types and Zod schemas.
// Apps MUST import from here; NEVER redefine types locally in apps/.
//
// Stubs populated in subsequent stories:
//   rbac.ts        — Story 1.3: UserRole enum, PERMISSIONS matrix, TIER_GATES
//   errors.ts      — Story 1.3: AppError class
//   api.ts         — Story 1.3: API response envelope types
//   tenant.ts      — Story 1.2: TenantContext, TenantId
//   evidence.ts    — Story 4.1: EvidenceItem, evidenceUploadSchema
//   controls.ts    — Story 3.1: ControlItem, ControlStatus
//   audits.ts      — Story 5.1: AuditEngagement, FindingStatus
//   integrations.ts — Story 4.4: IntegrationHealth, IntegrationConfig
//   jobs.ts        — Story 2.1: JobStatus, JobType
//   schemas/       — Zod schemas shared between Fastify validation and React Hook Form

export * from "./rbac";
export * from "./errors";
export * from "./api";
export * from "./tenant";
export * from "./evidence";
export * from "./controls";
export * from "./audits";
export * from "./integrations";
export * from "./jobs";
export * from "./fingerprint";
export * from "./fingerprint-confirm";
export * from "./framework-catalog";
export * from "./frameworks-api";
export * from "./onboarding";
