import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestEvidenceBlob } from "./ingest.js";
import { createMemoryBlobStorage } from "./storage.js";

describe("ingestEvidenceBlob", () => {
  const schema = "tenant_test";
  const storage = createMemoryBlobStorage();
  const putSpy = vi.spyOn(storage, "putObject");

  beforeEach(() => {
    putSpy.mockClear();
  });

  it("dedupes identical content and skips second upload", async () => {
    let blobSelectCount = 0;
    const existingBlobId = "blob-dedup-1";

    const db = {
      $queryRawUnsafe: vi.fn(async (sql: string) => {
        if (sql.includes("evidence_blobs") && sql.includes("content_hash")) {
          blobSelectCount += 1;
          return blobSelectCount === 1 ? [] : [{ id: existingBlobId }];
        }
        if (sql.includes("evidence_items")) {
          return [{ id: `ev-${blobSelectCount}` }];
        }
        return [];
      }),
      $executeRawUnsafe: vi.fn(async () => undefined),
    };

    const buf = Buffer.from("hello", "utf8");

    const first = await ingestEvidenceBlob({
      db,
      schemaName: schema,
      tenantId: "t1",
      controlItemId: "c1",
      bytes: buf,
      fileName: "n.txt",
      mimeType: "text/plain",
      source: "manual",
      sourceSystemRef: "test",
      bucketName: "bkt",
      storage,
    });

    expect(first.deduped).toBe(false);
    expect(putSpy).toHaveBeenCalledTimes(1);

    const second = await ingestEvidenceBlob({
      db,
      schemaName: schema,
      tenantId: "t1",
      controlItemId: "c2",
      bytes: buf,
      fileName: "n2.txt",
      mimeType: "text/plain",
      source: "manual",
      sourceSystemRef: "test",
      bucketName: "bkt",
      storage,
    });

    expect(second.deduped).toBe(true);
    expect(second.blobId).toBe(existingBlobId);
    expect(putSpy).toHaveBeenCalledTimes(1);
  });
});
