// Audit types — implemented in Story 5.1

export type AuditStatus = "draft" | "open" | "closed";

export type FindingStatus = "open" | "resolved";

export type FindingSeverity = "critical" | "high" | "medium" | "low";

export type AuditEngagement = {
  id: string;
  tenantId: string;
  name: string;
  frameworks: string[];
  status: AuditStatus;
  dateRangeStart: string; // ISO 8601
  dateRangeEnd: string; // ISO 8601
  createdBy: string;
  createdAt: string; // ISO 8601
};
