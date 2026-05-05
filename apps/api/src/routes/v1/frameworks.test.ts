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

import { prisma } from "@grc/db";
import { frameworkRoutes } from "./frameworks.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const SCHEMA = `tenant_${TENANT_ID.replace(/-/g, "")}`;

function buildApp(
  role: UserContext["role"] = "OrgAdmin",
  tier: "starter" | "growth" | "scale" = "starter",
  opts?: { trustProxy?: boolean }
): FastifyInstance {
  const app = Fastify({ logger: false, trustProxy: opts?.trustProxy ?? false });
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
      tier,
      schemaName: SCHEMA,
    };
  });
  app.register(frameworkRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
    fn(prisma)
  );
  vi.mocked(prisma.platformAuditLog.create).mockResolvedValue({ id: "audit1" } as never);
});

describe("GET /v1/frameworks/library", () => {
  it("returns catalog with tier and frameworks", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/frameworks/library" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { tier: string; frameworks: Array<{ id: string }>; recommended: string[] };
    };
    expect(body.data.tier).toBe("starter");
    expect(body.data.frameworks).toHaveLength(5);
    expect(body.data.recommended.length).toBeGreaterThan(0);
    await app.close();
  });

  it("derives recommended from committed fingerprint payload when present", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        {
          data: {
            industryClassification: {
              title: "Retail",
              detail: "Shops",
              confidence: 0.8,
              confidenceTier: "high",
              sources: ["x"],
            },
            regulatoryObligations: [
              {
                title: "GDPR applies to EU customers",
                detail: "Data subject requests",
                confidence: 0.9,
                confidenceTier: "high",
                sources: ["Legal"],
              },
            ],
            inferredOrgStructure: {
              title: "HQ",
              detail: "EU office",
              confidence: 0.5,
              confidenceTier: "medium",
              sources: ["Site"],
            },
            businessProcesses: [
              {
                title: "Sales",
                detail: "CRM",
                confidence: 0.7,
                confidenceTier: "medium",
                sources: ["S"],
              },
            ],
            riskDomains: [
              {
                title: "Privacy",
                detail: "PII",
                confidence: 0.8,
                confidenceTier: "high",
                sources: ["R"],
              },
            ],
          },
        },
      ] as never);

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/frameworks/library" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { recommended: string[] } };
    expect(body.data.recommended).toContain("GDPR");
    await app.close();
  });
});

describe("POST /v1/frameworks/activate", () => {
  it("returns 409 when framework already active", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ framework: "SOC2" }] as never);

    const app = buildApp("ControlOwner");
    const res = await app.inject({
      method: "POST",
      url: "/v1/frameworks/activate",
      payload: { frameworkIds: ["SOC2"] },
    });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("returns 400 when starter selects two frameworks", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([] as never);

    const app = buildApp("ControlOwner");
    const res = await app.inject({
      method: "POST",
      url: "/v1/frameworks/activate",
      payload: { frameworkIds: ["SOC2", "GDPR"] },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code?: string } };
    expect(body.error.code).toBe("TIER_SELECTION_LIMIT");
    await app.close();
  });

  it("activates on starter with one framework and writes audit + response shape", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(1 as never);

    const app = buildApp("OrgAdmin", "starter", { trustProxy: true });
    const res = await app.inject({
      method: "POST",
      url: "/v1/frameworks/activate",
      headers: { "x-forwarded-for": "203.0.113.50, 10.0.0.1" },
      payload: { frameworkIds: ["SOC2"] },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        activated: string[];
        controlsCreated: number;
        overlapPercent: number | null;
        alreadyCoveredCount: number;
        frameworkLabel: string;
      };
    };
    expect(body.data.activated).toEqual(["SOC2"]);
    expect(body.data.controlsCreated).toBeGreaterThan(0);
    expect(body.data.overlapPercent).toBeNull();
    expect(body.data.alreadyCoveredCount).toBe(0);
    expect(body.data.frameworkLabel).toContain("SOC");
    expect(prisma.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "framework.activated",
          resourceType: "framework_bundle",
          tenantId: TENANT_ID,
          actorId: "user_1",
        }) as Record<string, unknown>,
      })
    );

    const execCalls = vi.mocked(prisma.$executeRawUnsafe).mock.calls;
    const upsertSql = String(execCalls.find((c) => String(c[0]).includes("ON CONFLICT"))?.[0]);
    expect(upsertSql).toContain("framework_refs = EXCLUDED.framework_refs");
    expect(upsertSql).not.toContain("name = EXCLUDED.name");

    await app.close();
  });

  it("returns overlapPercent when activating multiple frameworks on growth", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(1 as never);

    const app = buildApp("OrgAdmin", "growth");
    const res = await app.inject({
      method: "POST",
      url: "/v1/frameworks/activate",
      payload: { frameworkIds: ["SOC2", "ISO27001", "GDPR"] },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { overlapPercent: number | null } };
    expect(typeof body.data.overlapPercent).toBe("number");
    await app.close();
  });

  it("allows three frameworks on growth tier", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(1 as never);

    const app = buildApp("OrgAdmin", "growth");
    const res = await app.inject({
      method: "POST",
      url: "/v1/frameworks/activate",
      payload: { frameworkIds: ["SOC2", "ISO27001", "GDPR"] },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("returns 409 on postgres unique violation during transaction", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505" }));

    const app = buildApp("ControlOwner");
    const res = await app.inject({
      method: "POST",
      url: "/v1/frameworks/activate",
      payload: { frameworkIds: ["SOC2"] },
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code?: string } };
    expect(body.error.code).toBe("FRAMEWORK_ALREADY_ACTIVE");
    await app.close();
  });

  it("returns 400 when growth selects a fourth framework in one request", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([] as never);

    const app = buildApp("OrgAdmin", "growth");
    const res = await app.inject({
      method: "POST",
      url: "/v1/frameworks/activate",
      payload: { frameworkIds: ["SOC2", "ISO27001", "GDPR", "SOX"] },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code?: string } };
    expect(body.error.code).toBe("TIER_SELECTION_LIMIT");
    await app.close();
  });

  it("returns alreadyCoveredCount when adding a framework over existing SOC2 rows", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ framework: "SOC2" }] as never)
      .mockResolvedValueOnce(
        [
          { canonical_id: "c-access-logical" },
          { canonical_id: "c-change-mgmt" },
          { canonical_id: "c-risk-program" },
          { canonical_id: "c-vendor" },
          { canonical_id: "c-soc-env" },
        ] as never
      );
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(1 as never);

    const app = buildApp("OrgAdmin", "growth");
    const res = await app.inject({
      method: "POST",
      url: "/v1/frameworks/activate",
      payload: { frameworkIds: ["ISO27001"] },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        alreadyCoveredCount: number;
        frameworkLabel: string;
        coverageBreakdown: Record<string, number>;
      };
    };
    expect(body.data.alreadyCoveredCount).toBe(3);
    expect(body.data.frameworkLabel).toContain("ISO");
    expect(body.data.coverageBreakdown["ISO27001"]).toBe(3);
    await app.close();
  });
});

describe("GET /v1/controls/:id", () => {
  it("returns requirementDetails for a unified control", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce(
      [
        {
          id: "ctrl1",
          canonical_id: "c-access-logical",
          name: "Logical access",
          domain: "Access Control",
          status: "pending",
          framework: "SOC2",
          framework_refs: ["ISO27001:A.9.2.1", "SOC2:CC6.1"],
        },
      ] as never
    );

    const app = buildApp("OrgAdmin", "growth");
    const res = await app.inject({ method: "GET", url: "/v1/controls/ctrl1" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        requirementDetails: Array<{ frameworkId: string; code: string }>;
        frameworkRefs: string[];
      };
    };
    expect(body.data.frameworkRefs.length).toBe(2);
    expect(body.data.requirementDetails.map((r) => r.frameworkId).sort()).toEqual(["ISO27001", "SOC2"]);
    await app.close();
  });

  it("returns 404 when missing", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([] as never);
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/controls/nope" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe("GET /v1/controls", () => {
  it("returns total, items, nextCursor", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ c: "2" }] as never)
      .mockResolvedValueOnce(
        [
          {
            id: "a",
            canonical_id: "c1",
            name: "Test",
            domain: "D",
            status: "pending",
            framework: "SOC2",
            framework_refs: ["SOC2:CC1"],
          },
          {
            id: "b",
            canonical_id: "c2",
            name: "Test2",
            domain: "D",
            status: "pending",
            framework: "SOC2",
            framework_refs: ["SOC2:CC2"],
          },
        ] as never
      );

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/controls?limit=1" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { total: number; items: unknown[]; nextCursor: string | null };
    };
    expect(body.data.total).toBe(2);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.nextCursor).toBe("a");
    await app.close();
  });
});
