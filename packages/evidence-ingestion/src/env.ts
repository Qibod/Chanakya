import type { BlobStoragePort } from "./storage.js";
import { createGcsBlobStorage, createMemoryBlobStorage } from "./storage.js";

const LOCAL_FALLBACK_BUCKET = "grc-evidence-local";

let memorySingleton: BlobStoragePort | null = null;

/**
 * Bucket for evidence objects. Prefer `GCS_EVIDENCE_BUCKET`; falls back to `GCS_BUCKET_NAME` from .env.example.
 */
export function getEvidenceBucketName(): string {
  return (
    process.env["GCS_EVIDENCE_BUCKET"]?.trim() ||
    process.env["GCS_BUCKET_NAME"]?.trim() ||
    ""
  );
}

/**
 * When a bucket name is set, uses real GCS (or the emulator via `STORAGE_EMULATOR_HOST`).
 * When unset (typical local dev), uses a shared in-memory store and {@link LOCAL_FALLBACK_BUCKET} in `storage_path` URIs.
 */
export function createBlobStorageFromEnv(): BlobStoragePort {
  const name = getEvidenceBucketName();
  if (!name) {
    if (!memorySingleton) {
      memorySingleton = createMemoryBlobStorage();
    }
    return memorySingleton;
  }
  return createGcsBlobStorage();
}

/** Virtual bucket name recorded in `storage_path` when using in-memory fallback. */
export function getEffectiveEvidenceBucketName(): string {
  return getEvidenceBucketName() || LOCAL_FALLBACK_BUCKET;
}
