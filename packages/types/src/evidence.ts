// Evidence types and Zod schemas — implemented in Story 4.1
// Shared between Fastify route validation and React Hook Form

export type EvidenceStatus = "current" | "archived" | "flagged" | "pending";

export type EvidenceItem = {
  id: string;
  controlId: string;
  tenantId: string;
  fileName: string;
  contentHash: string; // SHA-256
  sourceSystem: string | null;
  lastSyncedAt: string | null; // ISO 8601
  status: EvidenceStatus;
  createdAt: string; // ISO 8601
};

// evidenceUploadSchema (Zod) — implemented in Story 4.7
