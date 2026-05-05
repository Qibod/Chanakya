import { describe, it, expect } from "vitest";
import { ROLE_SATISFIES, TIER_ORDER, UserRole, SubscriptionTier } from "./rbac";

describe("ROLE_SATISFIES", () => {
  it("ControlOwner does NOT satisfy AuditDirector", () => {
    expect(ROLE_SATISFIES[UserRole.ControlOwner]).not.toContain(UserRole.AuditDirector);
  });

  it("OrgAdmin satisfies AuditDirector", () => {
    expect(ROLE_SATISFIES[UserRole.OrgAdmin]).toContain(UserRole.AuditDirector);
  });

  it("OrgAdmin satisfies ControlOwner and ReadOnly", () => {
    expect(ROLE_SATISFIES[UserRole.OrgAdmin]).toContain(UserRole.ControlOwner);
    expect(ROLE_SATISFIES[UserRole.OrgAdmin]).toContain(UserRole.ReadOnly);
  });

  it("PlatformSuperAdmin satisfies every role", () => {
    const allRoles = Object.values(UserRole) as UserRole[];
    for (const role of allRoles) {
      expect(ROLE_SATISFIES[UserRole.PlatformSuperAdmin]).toContain(role);
    }
  });

  it("AuditDirector satisfies ControlOwner and ReadOnly but NOT OrgAdmin", () => {
    expect(ROLE_SATISFIES[UserRole.AuditDirector]).toContain(UserRole.ControlOwner);
    expect(ROLE_SATISFIES[UserRole.AuditDirector]).toContain(UserRole.ReadOnly);
    expect(ROLE_SATISFIES[UserRole.AuditDirector]).not.toContain(UserRole.OrgAdmin);
  });

  it("ReadOnly only satisfies ReadOnly", () => {
    expect(ROLE_SATISFIES[UserRole.ReadOnly]).toEqual([UserRole.ReadOnly]);
  });

  it("BoardExecutive only satisfies BoardExecutive", () => {
    expect(ROLE_SATISFIES[UserRole.BoardExecutive]).toEqual([UserRole.BoardExecutive]);
  });

  it("ExternalAuditor only satisfies ExternalAuditor", () => {
    expect(ROLE_SATISFIES[UserRole.ExternalAuditor]).toEqual([UserRole.ExternalAuditor]);
  });
});

describe("TIER_ORDER", () => {
  it("starter < growth < scale", () => {
    expect(TIER_ORDER[SubscriptionTier.starter]).toBeLessThan(TIER_ORDER[SubscriptionTier.growth]);
    expect(TIER_ORDER[SubscriptionTier.growth]).toBeLessThan(TIER_ORDER[SubscriptionTier.scale]);
  });

  it("growth satisfies growth gate", () => {
    expect(TIER_ORDER[SubscriptionTier.growth] >= TIER_ORDER[SubscriptionTier.growth]).toBe(true);
  });

  it("starter does NOT satisfy growth gate", () => {
    expect(TIER_ORDER[SubscriptionTier.starter] >= TIER_ORDER[SubscriptionTier.growth]).toBe(false);
  });

  it("scale satisfies all tiers", () => {
    const tiers = Object.values(SubscriptionTier) as SubscriptionTier[];
    for (const tier of tiers) {
      expect(TIER_ORDER[SubscriptionTier.scale] >= TIER_ORDER[tier]).toBe(true);
    }
  });
});
