import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { UserContext } from "@grc/types";

vi.mock("@grc/evidence-ingestion", () => ({
  createBlobStorageFromEnv: vi.fn(() => ({})),
  readVerifiedBlobBytes: vi.fn(),
}));

vi.mock("@grc/db", () => {
  const prisma = {
    $queryRawUnsafe: vi.fn(),
    platformAuditLog: {
      create: vi.fn(),
    },
  };
  return { prisma };
});

import { prisma } from "@grc/db";
import { readVerifiedBlobBytes, createBlobStorageFromEnv } from "@grc/evidence-ingestion";
import { evidenceItemRoutes } from "./evidence-items.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const SCHEMA = `tenant_${TENANT_ID.replace(/-/g, "")}`;

function buildApp(role: UserContext["role"] = "AuditDirector"): FastifyInstance {
  const app: FastifyInstance = Fastify({ logger: false });
  app.decorateRequest("user", null as unknown as UserContext);
  app.decorateRequest("tenant", null as never);
  app.addHook("preHandler", async (request) => {
    request.user = {
      userId: "user_1",
      orgId: TENANT_ID,
      role,
      sessionId: "sess_1",
    };
    request.tenant = {
      tenantId: TENANT_ID,
      tier: "starter",
      schemaName: SCHEMA,
    };
  });
  app.register(evidenceItemRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /v1/evidence-items/:evidenceItemId/download", () => {
  it("returns 403 for ReadOnly", async () => {
    const app = buildApp("ReadOnly");
    const res = await app.inject({ method: "GET", url: "/v1/evidence-items/e1/download" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("allows AuditDirector when evidence row exists", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce(
        [
          {
            storage_path: "gs://b/t/x",
            content_hash: "abc".repeat(10) + "ab", // 32 hex - invalid length, but not used if mock throws
            mime_type: "text/plain",
            file_name: "note.txt",
          },
        ] as never
      );
    vi.mocked(readVerifiedBlobBytes).mockResolvedValueOnce(Buffer.from("ok", "utf8"));

    const app = buildApp("AuditDirector");
    const res = await app.inject({ method: "GET", url: "/v1/evidence-items/e1/download" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("ok");
    expect(createBlobStorageFromEnv).toHaveBeenCalled();
    await app.close();
  });

  it("allows ControlOwner when assigned to control for that evidence item", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ ok: 1 }] as never)
      .mockResolvedValueOnce(
        [
          {
            storage_path: "gs://b/t/x",
            content_hash: "a".repeat(64),
            mime_type: "text/plain",
            file_name: "note.txt",
          },
        ] as never
      );
    vi.mocked(readVerifiedBlobBytes).mockResolvedValueOnce(Buffer.from("x"));

    const app = buildApp("ControlOwner");
    const res = await app.inject({ method: "GET", url: "/v1/evidence-items/e1/download" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("returns 403 for ControlOwner when not assignee", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([] as never);

    const app = buildApp("ControlOwner");
    const res = await app.inject({ method: "GET", url: "/v1/evidence-items/e1/download" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("returns 500 and logs audit on integrity failure", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce(
      [
        {
          storage_path: "gs://b/t/x",
          content_hash: "a".repeat(64),
          mime_type: "text/plain",
          file_name: "note.txt",
        },
      ] as never
    );
    const err = new Error("bad");
    (err as Error & { code?: string }).code = "EVIDENCE_INTEGRITY_FAILURE";
    vi.mocked(readVerifiedBlobBytes).mockRejectedValueOnce(err);

    const app = buildApp("AuditDirector");
    const res = await app.inject({ method: "GET", url: "/v1/evidence-items/e1/download" });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error?: { code?: string } };
    expect(body.error?.code).toBe("EVIDENCE_INTEGRITY_FAILURE");
    expect(prisma.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "evidence.integrity_failure",
          resourceId: "e1",
        }),
      })
    );
    await app.close();
  });
});
