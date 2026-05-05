import { Storage } from "@google-cloud/storage";

export type BlobStoragePort = {
  putObject(gsUri: string, body: Buffer, contentType: string): Promise<void>;
  readObjectFull(gsUri: string): Promise<Buffer>;
};

export function parseGsUri(storagePath: string): { bucket: string; objectName: string } {
  const m = /^gs:\/\/([^/]+)\/(.+)$/.exec(storagePath.trim());
  if (!m) {
    throw new Error(`Invalid storage path (expected gs://bucket/key): ${storagePath}`);
  }
  return { bucket: m[1]!, objectName: m[2]! };
}

/** In-memory store keyed by full `gs://…` URI (tests + local dev without GCS). */
export function createMemoryBlobStorage(): BlobStoragePort {
  const objects = new Map<string, Buffer>();
  return {
    async putObject(gsUri, body) {
      parseGsUri(gsUri);
      objects.set(gsUri, Buffer.from(body));
    },
    async readObjectFull(gsUri) {
      const b = objects.get(gsUri);
      if (!b) {
        throw new Error(`Blob not found: ${gsUri}`);
      }
      return b;
    },
  };
}

export function createGcsBlobStorage(): BlobStoragePort {
  const storage = new Storage();
  return {
    async putObject(gsUri, body, contentType) {
      const { bucket, objectName } = parseGsUri(gsUri);
      const file = storage.bucket(bucket).file(objectName);
      await file.save(body, {
        contentType,
        resumable: false,
      });
    },
    async readObjectFull(gsUri) {
      const { bucket, objectName } = parseGsUri(gsUri);
      const file = storage.bucket(bucket).file(objectName);
      const [buf] = await file.download();
      return buf;
    },
  };
}
