/* eslint-disable no-console -- worker job error logging (Story 2.1) */
import * as Sentry from "@sentry/node";
import { prisma } from "@grc/db";
import type { FingerprintInferencePayload } from "@grc/types";
import { runFingerprintInference } from "@grc/ai";
import { redis } from "../redis.js";
import { publishJobEvent } from "../publishers/job-events.js";

export type FingerprintTaskPayload = {
  tenantId: string;
  schemaName: string;
  jobId: string;
  companyName: string;
};

const JOB_KEY_PREFIX = "grc:job:";
const TTL = 86_400;

function failureCode(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message;
    if (m === "LLM_OUTPUT_INVALID") return "LLM_OUTPUT_INVALID";
    if (m.includes("Vertex AI project not configured")) return "VERTEX_NOT_CONFIGURED";
    return m.slice(0, 240);
  }
  return "UNKNOWN";
}

export async function processFingerprintJob(payload: FingerprintTaskPayload): Promise<void> {
  const { tenantId, schemaName, jobId, companyName } = payload;

  await redis.set(
    `${JOB_KEY_PREFIX}${jobId}`,
    JSON.stringify({
      status: "in_progress",
      tenantId,
      startedAt: new Date().toISOString(),
    }),
    "EX",
    TTL
  );

  const started = Date.now();

  try {
    const inference = await runFingerprintInference(companyName);
    await persistSuccess(schemaName, jobId, inference);

    await redis.set(
      `${JOB_KEY_PREFIX}${jobId}`,
      JSON.stringify({
        status: "completed",
        tenantId,
        durationMs: Date.now() - started,
        completedAt: new Date().toISOString(),
      }),
      "EX",
      TTL
    );

    await publishJobEvent(tenantId, jobId, {
      event: "fingerprint.completed",
      data: {
        tenantId,
        timestamp: new Date().toISOString(),
        payload: {
          jobId,
          status: "pending_review" as const,
          summary: inference,
        },
      },
    });
  } catch (err) {
    const code = failureCode(err);
    console.error({ jobId, tenantId, err }, "fingerprint job failed");
    Sentry.captureException(err, {
      tags: { jobType: "fingerprint" },
      extra: { jobId, tenantId, failureCode: code },
    });

    await prisma.$executeRawUnsafe(
      `UPDATE "${schemaName}".fingerprint_results SET status = 'failed', failure_reason = $1, updated_at = NOW() WHERE job_id = $2`,
      code,
      jobId
    );

    await redis.set(
      `${JOB_KEY_PREFIX}${jobId}`,
      JSON.stringify({
        status: "failed",
        tenantId,
        durationMs: Date.now() - started,
        error: code,
        completedAt: new Date().toISOString(),
      }),
      "EX",
      TTL
    );

    await publishJobEvent(tenantId, jobId, {
      event: "fingerprint.failed",
      data: {
        tenantId,
        timestamp: new Date().toISOString(),
        payload: {
          jobId,
          status: "failed" as const,
          failureReason: code,
        },
      },
    });

    throw err;
  }
}

async function persistSuccess(
  schemaName: string,
  jobId: string,
  inference: FingerprintInferencePayload
): Promise<void> {
  const dataJson = JSON.stringify(inference);
  const scoresJson = JSON.stringify({
    industryConfidence: inference.industryClassification.confidence,
  });

  await prisma.$executeRawUnsafe(
    `UPDATE "${schemaName}".fingerprint_results SET
      status = 'pending_review',
      data = $1::jsonb,
      confidence_scores = $2::jsonb,
      industry = $3,
      failure_reason = NULL,
      updated_at = NOW()
     WHERE job_id = $4`,
    dataJson,
    scoresJson,
    inference.industryClassification.title,
    jobId
  );
}
