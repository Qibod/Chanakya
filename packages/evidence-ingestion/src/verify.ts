import { createHash } from "node:crypto";
import type { BlobStoragePort } from "./storage.js";

export function hashBufferSha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Download blob bytes and verify they match the stored content hash (full-buffer MVP — suitable for small evidence notes).
 */
export async function readVerifiedBlobBytes(params: {
  storage: BlobStoragePort;
  storagePath: string;
  expectedContentHashHex: string;
}): Promise<Buffer> {
  const bytes = await params.storage.readObjectFull(params.storagePath);
  const digest = hashBufferSha256Hex(bytes);
  if (digest !== params.expectedContentHashHex) {
    const err = new Error("Evidence content hash mismatch after download");
    (err as Error & { code?: string }).code = "EVIDENCE_INTEGRITY_FAILURE";
    throw err;
  }
  return bytes;
}
