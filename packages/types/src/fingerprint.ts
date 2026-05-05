import { z } from "zod";

/** Confidence bucket aligned with PRD / epic (numeric thresholds applied when mapping LLM output). */
export const confidenceTierSchema = z.enum(["high", "medium", "low"]);
export type ConfidenceTier = z.infer<typeof confidenceTierSchema>;

/** One inferred facet with confidence + human-readable sources (e.g. "LinkedIn", "SEC filings"). */
export const fingerprintSliceSchema = z.object({
  title: z.string().min(1),
  detail: z.string(),
  /** 0..1 from model; server may re-derive confidenceTier from this. */
  confidence: z.number().min(0).max(1),
  confidenceTier: confidenceTierSchema,
  sources: z.array(z.string().min(1)).min(1),
});
export type FingerprintSlice = z.infer<typeof fingerprintSliceSchema>;

/**
 * Structured JSON expected from the fingerprint LLM (parsed + validated in worker).
 * camelCase throughout for API boundaries.
 */
export const fingerprintInferencePayloadSchema = z.object({
  industryClassification: fingerprintSliceSchema,
  regulatoryObligations: z.array(fingerprintSliceSchema).min(1),
  inferredOrgStructure: fingerprintSliceSchema,
  businessProcesses: z.array(fingerprintSliceSchema).min(1),
  riskDomains: z.array(fingerprintSliceSchema).min(1),
});
export type FingerprintInferencePayload = z.infer<typeof fingerprintInferencePayloadSchema>;

export const postFingerprintBodySchema = z.object({
  companyName: z.string().trim().min(1).max(512),
});
export type PostFingerprintBody = z.infer<typeof postFingerprintBodySchema>;

/** Stored row lifecycle for fingerprint_results.status */
export const fingerprintRowStatusSchema = z.enum([
  "queued",
  "pending_review",
  "failed",
  "committed",
]);
export type FingerprintRowStatus = z.infer<typeof fingerprintRowStatusSchema>;

/** Redis / SSE job lifecycle (async job runner). */
export const fingerprintJobEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("fingerprint.completed"),
    data: z.object({
      tenantId: z.string(),
      payload: z.object({
        jobId: z.string(),
        status: z.literal("pending_review"),
        summary: fingerprintInferencePayloadSchema.optional(),
      }),
      timestamp: z.string(),
    }),
  }),
  z.object({
    event: z.literal("fingerprint.failed"),
    data: z.object({
      tenantId: z.string(),
      payload: z.object({
        jobId: z.string(),
        status: z.literal("failed"),
        failureReason: z.string(),
      }),
      timestamp: z.string(),
    }),
  }),
]);
export type FingerprintJobEvent = z.infer<typeof fingerprintJobEventSchema>;
