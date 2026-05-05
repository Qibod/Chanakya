export const UserRole = {
  OrgAdmin: "OrgAdmin",
  AuditDirector: "AuditDirector",
  ControlOwner: "ControlOwner",
  ReadOnly: "ReadOnly",
  BoardExecutive: "BoardExecutive",
  ExternalAuditor: "ExternalAuditor",
  Developer: "Developer",
  PlatformSuperAdmin: "PlatformSuperAdmin",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SubscriptionTier = {
  starter: "starter",
  growth: "growth",
  scale: "scale",
} as const;

export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

// Defines which route-required roles each user role can satisfy.
// requireRole('AuditDirector') passes if ROLE_SATISFIES[user.role].includes('AuditDirector').
export const ROLE_SATISFIES: Record<UserRole, ReadonlyArray<UserRole>> = {
  PlatformSuperAdmin: Object.values(UserRole) as UserRole[],
  OrgAdmin: ["OrgAdmin", "AuditDirector", "ControlOwner", "ReadOnly"],
  AuditDirector: ["AuditDirector", "ControlOwner", "ReadOnly"],
  ControlOwner: ["ControlOwner", "ReadOnly"],
  ReadOnly: ["ReadOnly"],
  // Deliberate isolation: these roles are lateral, not hierarchical.
  // BoardExecutive sees board-level views; ExternalAuditor sees audit-scoped views only;
  // Developer accesses platform tooling. None satisfies ReadOnly (or any core RBAC role)
  // because cross-role access would break the audit-isolation model.
  // Do NOT add ReadOnly here without a security review.
  BoardExecutive: ["BoardExecutive"],
  ExternalAuditor: ["ExternalAuditor"],
  Developer: ["Developer"],
} as const;

// Tier ordering for requireTier() gate checks.
export const TIER_ORDER: Record<SubscriptionTier, number> = {
  starter: 0,
  growth: 1,
  scale: 2,
} as const;

// Request-scoped user context — set by authenticate + tenantMiddleware.
export type UserContext = {
  userId: string;     // Clerk user ID (JWT sub)
  orgId: string;      // Clerk org ID = GRC tenantId (JWT o.id)
  role: UserRole;     // looked up from role_assignments by tenantMiddleware
  sessionId: string;  // Clerk session ID (JWT sid)
};
