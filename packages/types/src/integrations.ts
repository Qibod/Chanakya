// Integration types — implemented in Story 4.4

export type IntegrationStatus = "connected" | "degraded" | "failed" | "disconnected";

export type IntegrationProvider = "okta" | "aws" | "salesforce" | "jira" | "custom";

export type IntegrationHealth = {
  integrationId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  lastSyncedAt: string | null; // ISO 8601
  evidenceCollectedLast24h: number;
};
