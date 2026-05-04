// Job types — implemented in Story 2.1
// Cloud Tasks job naming: {tenantId}.{jobType}.{uuidv7}

export type JobType =
  | "fingerprint"
  | "report-generate"
  | "evidence-sync"
  | "regulatory-scan"
  | "integration-poll";

export type JobStatus = "pending" | "in_progress" | "completed" | "failed";

export type JobResult = {
  jobId: string;
  type: JobType;
  status: JobStatus;
  tenantId: string;
  createdAt: string; // ISO 8601
  completedAt: string | null; // ISO 8601
  error: string | null;
};
