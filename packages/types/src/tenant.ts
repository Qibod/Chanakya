// CRITICAL: tenant always from request.tenant (set by middleware); NEVER from request.params.tenantId

import type { SubscriptionTier } from "./rbac";

export type TenantId = string;

export type TenantContext = {
  tenantId: TenantId;
  tier: SubscriptionTier;
  schemaName: string; // tenant_{uuid_no_hyphens}
};
