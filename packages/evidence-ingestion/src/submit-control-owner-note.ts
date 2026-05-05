import type { PrismaClient } from "@prisma/client";
import type { BlobStoragePort } from "./storage.js";
import { ingestEvidenceBlob, type DbClient } from "./ingest.js";

export type SubmitControlOwnerNoteParams = {
  prisma: PrismaClient;
  schemaName: string;
  tenantId: string;
  controlItemId: string;
  assignmentId: string;
  userId: string;
  evidenceText: string;
  storage: BlobStoragePort;
  bucketName: string;
};

/**
 * D4 completion: persist UTF-8 note as evidence + link `control_owner_task_completions` in one transaction.
 */
export async function submitControlOwnerNoteEvidence(
  params: SubmitControlOwnerNoteParams
): Promise<{ evidenceItemId: string }> {
  const bytes = Buffer.from(params.evidenceText, "utf8");

  return params.prisma.$transaction(async (tx: DbClient) => {
    const { evidenceItemId } = await ingestEvidenceBlob({
      db: tx,
      schemaName: params.schemaName,
      tenantId: params.tenantId,
      controlItemId: params.controlItemId,
      bytes,
      fileName: "control-owner-note.txt",
      mimeType: "text/plain; charset=utf-8",
      source: "manual",
      sourceSystemRef: "my-tasks",
      storage: params.storage,
      bucketName: params.bucketName,
    });

    await tx.$executeRawUnsafe(
      `INSERT INTO "${params.schemaName}".control_owner_task_completions (assignment_id, evidence_item_id, completed_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (assignment_id) DO UPDATE SET
         completed_at = NOW(),
         evidence_item_id = EXCLUDED.evidence_item_id,
         completed_by = EXCLUDED.completed_by`,
      params.assignmentId,
      evidenceItemId,
      params.userId
    );

    return { evidenceItemId };
  });
}
