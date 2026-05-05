import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { UserContext } from "@grc/types";

vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: vi.fn().mockReturnValue({
    userId: "user_1",
    orgId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    sessionId: "sess_1",
  }),
}));

vi.mock("@grc/db", () => {
  const prisma = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn(),
    $transaction: vi.fn(),
    platformAuditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit1" }),
    },
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
    fn(prisma)
  );
  return { prisma };
});

vi.mock("../../plugins/redis.js", () => ({
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../../services/fingerprint-queue.js", () => ({
  deliverFingerprintTask: vi.fn().mockResolvedValue(undefined),
}));

import { getAuth } from "@clerk/fastify";
import { prisma } from "@grc/db";
import { redis } from "../../plugins/redis.js";
import { deliverFingerprintTask } from "../../services/fingerprint-queue.js";
import { fingerprintRoutes } from "./fingerprint.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";

function buildApp(
  role: UserContext["role"] = "OrgAdmin",
  opts?: { schemaName?: string }
): FastifyInstance {
  const app = Fastify({ logger: false });
  app.decorateRequest("user", null as unknown as UserContext);
  app.decorateRequest("tenant", null as never);
  app.addHook("preHandler", async (request, _reply) => {
    request.user = {
      userId: "user_1",
      orgId: TENANT_ID,
      role,
      sessionId: "sess_1",
    };
    request.tenant = {
      tenantId: TENANT_ID,
      tier: "starter",
      schemaName: opts?.schemaName ?? `tenant_${TENANT_ID.replace(/-/g, "")}`,
    };
  });
  app.register(fingerprintRoutes);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAuth).mockReturnValue({
    userId: "user_1",
    orgId: TENANT_ID,
    sessionId: "sess_1",
  } as ReturnType<typeof getAuth>);
  vi.mocked(deliverFingerprintTask).mockResolvedValue(undefined);
  vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(1 as never);
  vi.mocked(redis.set).mockResolvedValue("OK");
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
    fn(prisma)
  );
  vi.mocked(prisma.platformAuditLog.create).mockResolvedValue({ id: "audit1" } as never);
});

describe("POST /v1/fingerprint", () => {
  it("returns 202 with jobId", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/fingerprint",
      payload: { companyName: "Acme Corp" },
    });
    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body) as { data: { jobId: string } };
    expect(body.data.jobId).toContain(".fingerprint.");
    expect(deliverFingerprintTask).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("returns 400 on empty company name", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/fingerprint",
      payload: { companyName: "  " },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 403 when role is Read-only (cannot satisfy ControlOwner gate)", async () => {
    const app = buildApp("ReadOnly");
    const res = await app.inject({
      method: "POST",
      url: "/v1/fingerprint",
      payload: { companyName: "Acme Corp" },
    });
    expect(res.statusCode).toBe(403);
    expect(deliverFingerprintTask).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("GET /v1/fingerprint/:jobId", () => {
  it("returns row when found", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
      {
        job_id: `${TENANT_ID}.fingerprint.id`,
        status: "queued",
        failure_reason: null,
        data: {},
        company_name: "Acme",
      },
    ] as never);

    const app = buildApp();
    const jobId = `${TENANT_ID}.fingerprint.testjob`;
    const res = await app.inject({
      method: "GET",
      url: `/v1/fingerprint/${encodeURIComponent(jobId)}`,
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

const VALID_INFERENCE = {
  industryClassification: {
    title: "Software",
    detail: "SaaS",
    confidence: 0.9,
    confidenceTier: "high" as const,
    sources: ["SEC"],
  },
  regulatoryObligations: [
    {
      title: "SOC 2",
      detail: "Trust",
      confidence: 0.8,
      confidenceTier: "high" as const,
      sources: ["AICPA"],
    },
  ],
  inferredOrgStructure: {
    title: "Flat",
    detail: "Eng",
    confidence: 0.85,
    confidenceTier: "high" as const,
    sources: ["LinkedIn"],
  },
  businessProcesses: [
    {
      title: "Deploy",
      detail: "CI/CD",
      confidence: 0.8,
      confidenceTier: "high" as const,
      sources: ["APQC"],
    },
  ],
  riskDomains: [
    {
      title: "Access",
      detail: "IAM",
      confidence: 0.75,
      confidenceTier: "medium" as const,
      sources: ["NIST"],
    },
  ],
};

describe("POST /v1/fingerprint/:jobId/confirm", () => {
  it("commits and writes audit log", async () => {
    const jobId = `${TENANT_ID}.fingerprint.confirm1`;
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([
        {
          job_id: jobId,
          status: "pending_review",
          data: VALID_INFERENCE,
        },
      ] as never)
      .mockResolvedValueOnce([{ job_id: jobId }] as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/v1/fingerprint/${encodeURIComponent(jobId)}/confirm`,
      payload: { overrides: {}, removedLineIds: [] },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { status: string } };
    expect(body.data.status).toBe("committed");
    expect(prisma.platformAuditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_ID,
        actorId: "user_1",
        action: "fingerprint.confirmed",
        resourceType: "fingerprint_job",
        resourceId: jobId,
      }),
    });
    await app.close();
  });

  it("returns 500 INVALID_SCHEMA_NAME when tenant schema fails allowlist", async () => {
    const jobId = `${TENANT_ID}.fingerprint.badschema`;
    const app = buildApp("OrgAdmin", { schemaName: 'tenant_broken"; SELECT 1;--' });
    const res = await app.inject({
      method: "POST",
      url: `/v1/fingerprint/${encodeURIComponent(jobId)}/confirm`,
      payload: {},
    });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_SCHEMA_NAME");
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 400 INVALID_STATE when status is queued", async () => {
    const jobId = `${TENANT_ID}.fingerprint.queued`;
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
      {
        job_id: jobId,
        status: "queued",
        data: {},
      },
    ] as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/v1/fingerprint/${encodeURIComponent(jobId)}/confirm`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_STATE");
    await app.close();
  });

  it("returns 400 INVALID_STATE when status is failed", async () => {
    const jobId = `${TENANT_ID}.fingerprint.failedrow`;
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
      {
        job_id: jobId,
        status: "failed",
        data: {},
      },
    ] as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/v1/fingerprint/${encodeURIComponent(jobId)}/confirm`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_STATE");
    await app.close();
  });

  it("returns 500 DATA_CORRUPT when stored JSON does not parse as inference", async () => {
    const jobId = `${TENANT_ID}.fingerprint.corrupt`;
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
      {
        job_id: jobId,
        status: "pending_review",
        data: { invalid: true },
      },
    ] as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/v1/fingerprint/${encodeURIComponent(jobId)}/confirm`,
      payload: {},
    });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error.code).toBe("DATA_CORRUPT");
    await app.close();
  });

  it("returns 400 REQUIRED_LIST_EMPTY when merge empties obligations", async () => {
    const jobId = `${TENANT_ID}.fingerprint.emptyobl`;
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
      {
        job_id: jobId,
        status: "pending_review",
        data: VALID_INFERENCE,
      },
    ] as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/v1/fingerprint/${encodeURIComponent(jobId)}/confirm`,
      payload: { removedLineIds: ["obligation-0"] },
    });
    expect(res.statusCode).toBe(400);
    const err = JSON.parse(res.body) as {
      error: { code: string; details?: unknown };
    };
    expect(err.error.code).toBe("REQUIRED_LIST_EMPTY");
    expect(err.error.details).toBeDefined();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 400 VALIDATION_ERROR when confirm body has too many override keys", async () => {
    const jobId = `${TENANT_ID}.fingerprint.oversize`;
    const overrides = Object.fromEntries(
      Array.from({ length: 129 }, (_, i) => [`k${i}`, "v"])
    );

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/v1/fingerprint/${encodeURIComponent(jobId)}/confirm`,
      payload: { overrides },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 403 when jobId prefix does not match tenant", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/fingerprint/other-tenant.fingerprint.x/confirm",
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 when row already committed", async () => {
    const jobId = `${TENANT_ID}.fingerprint.already`;
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
      {
        job_id: jobId,
        status: "committed",
        data: VALID_INFERENCE,
      },
    ] as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/v1/fingerprint/${encodeURIComponent(jobId)}/confirm`,
      payload: {},
    });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("returns 409 when concurrent update commits first (RETURNING empty)", async () => {
    const jobId = `${TENANT_ID}.fingerprint.race`;
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([
        {
          job_id: jobId,
          status: "pending_review",
          data: VALID_INFERENCE,
        },
      ] as never)
      .mockResolvedValueOnce([] as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/v1/fingerprint/${encodeURIComponent(jobId)}/confirm`,
      payload: {},
    });
    expect(res.statusCode).toBe(409);
    expect(prisma.platformAuditLog.create).not.toHaveBeenCalled();
    await app.close();
  });

  it("commits with overrides and removals (audit ip optional)", async () => {
    const jobId = `${TENANT_ID}.fingerprint.payloadshape`;
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([
        {
          job_id: jobId,
          status: "pending_review",
          data: VALID_INFERENCE,
        },
      ] as never)
      .mockResolvedValueOnce([{ job_id: jobId }] as never);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/v1/fingerprint/${encodeURIComponent(jobId)}/confirm`,
      payload: {
        overrides: { industry: "Edited: Title" },
        removedLineIds: ["integrations-synthetic"],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(prisma.platformAuditLog.create).toHaveBeenCalled();
    await app.close();
  });
});
