import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { BlobStoragePort } from "./storage.js";

/** Prisma client or interactive transaction client. */
export type DbClient = Pick<PrismaClient, "$queryRawUnsafe" | "$executeRawUnsafe">;

export type IngestEvidenceBlobParams = {
  db: DbClient;
  schemaName: string;
  tenantId: string;
  controlItemId: string;
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  source: string;
  sourceSystemRef: string;
  businessUnitId?: string | null;
  bucketName: string;
  storage: BlobStoragePort;
};

export type IngestEvidenceBlobResult = {
  blobId: string;
  evidenceItemId: string;
  deduped: boolean;
};

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Content-addressed ingest: hash → dedupe by `content_hash` → optional GCS upload → insert `evidence_blobs` (insert-only) → `evidence_items`.
 */
export async function ingestEvidenceBlob(
  params: IngestEvidenceBlobParams
): Promise<IngestEvidenceBlobResult> {
  const hash = sha256Hex(params.bytes);

  const existing = (await params.db.$queryRawUnsafe(
    `SELECT id FROM "${params.schemaName}".evidence_blobs WHERE content_hash = $1 LIMIT 1`,
    hash
  )) as Array<{ id: string }>;

  let blobId: string;
  let deduped: boolean;

  if (existing[0]?.id) {
    blobId = existing[0].id;
    deduped = true;
  } else {
    deduped = false;
    blobId = randomUUID();
    const objectName = `${params.tenantId}/${blobId}`;
    const storagePath = `gs://${params.bucketName}/${objectName}`;

    await params.storage.putObject(storagePath, params.bytes, params.mimeType);

    await params.db.$executeRawUnsafe(
      `INSERT INTO "${params.schemaName}".evidence_blobs (id, content_hash, storage_path, file_size_bytes, mime_type)
       VALUES ($1, $2, $3, $4, $5)`,
      blobId,
      hash,
      storagePath,
      params.bytes.length,
      params.mimeType
    );
  }

  const inserted = (await params.db.$queryRawUnsafe(
    `INSERT INTO "${params.schemaName}".evidence_items
       (control_item_id, blob_id, file_name, source, source_system_ref, is_current, business_unit_id)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6)
     RETURNING id`,
    params.controlItemId,
    blobId,
    params.fileName,
    params.source,
    params.sourceSystemRef,
    params.businessUnitId ?? null
  )) as Array<{ id: string }>;

  const evidenceItemId = inserted[0]?.id;
  if (!evidenceItemId) {
    throw new Error("ingestEvidenceBlob: missing evidence_item id after insert");
  }

  return { blobId, evidenceItemId, deduped };
}
