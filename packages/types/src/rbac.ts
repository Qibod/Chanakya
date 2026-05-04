// RBAC types — fully implemented in Story 1.3
// 8 roles; permission matrix; tier gates

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

// Full PERMISSIONS and TIER_GATES constants added in Story 1.3
