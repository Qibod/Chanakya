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

vi.mock("@grc/ai", () => ({
  VertexAIProvider: class VertexAIProvider {
    async complete() {
      return {
        content: "1. Do the thing.\n2. Confirm the thing.\n\nReferences:\n- SOC2:CC6.1",
        model: "claude-sonnet-4-6",
        inputTokens: 1,
        outputTokens: 1,
      };
    }
  },
  generateTaskInstructions: async (_provider: unknown, _input: unknown) =>
    "1. Do the thing.\n2. Confirm the thing.\n\nReferences:\n- SOC2:CC6.1",
}));

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
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce(
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
      )
      .mockResolvedValueOnce([] as never) // integrations
      .mockResolvedValueOnce([] as never); // assignment

    const app = buildApp("OrgAdmin", "growth");
    const res = await app.inject({ method: "GET", url: "/v1/controls/ctrl1" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        requirementDetails: Array<{ frameworkId: string; code: string }>;
        frameworkRefs: string[];
        assignment?: { assignedTo: string | null; instruction: string | null } | null;
        instructionRegenerated?: boolean;
      };
    };
    expect(body.data.frameworkRefs.length).toBe(2);
    expect(body.data.requirementDetails.map((r) => r.frameworkId).sort()).toEqual(["ISO27001", "SOC2"]);
    await app.close();
  });

  it("includes assignment data when present", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce(
        [
          {
            id: "ctrl1",
            canonical_id: "c-access-logical",
            name: "Logical access",
            domain: "Access Control",
            status: "in_review",
            framework: "SOC2",
            framework_refs: ["SOC2:CC6.1"],
          },
        ] as never
      )
      .mockResolvedValueOnce([] as never) // integrations
      .mockResolvedValueOnce(
        [
          {
            id: "as1",
            assigned_to: "user_2",
            due_date: "2026-06-01",
            instruction: "Do X",
            instruction_updated_at: new Date("2026-05-05T10:00:00Z"),
            instruction_context: { integrations: ["okta"] },
          },
        ] as never
      );

    const app = buildApp("OrgAdmin", "growth");
    const res = await app.inject({ method: "GET", url: "/v1/controls/ctrl1" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { assignment: { assignedTo: string } | null } };
    expect(body.data.assignment?.assignedTo).toBe("user_2");
    await app.close();
  });

  it("regenerates instruction when integrations change", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce(
        [
          {
            id: "ctrl1",
            canonical_id: "c-access-logical",
            name: "Logical access",
            domain: "Access Control",
            status: "in_review",
            framework: "SOC2",
            framework_refs: ["SOC2:CC6.1"],
          },
        ] as never
      )
      .mockResolvedValueOnce([{ provider: "aws" }] as never) // integrations now
      .mockResolvedValueOnce(
        [
          {
            id: "as1",
            assigned_to: "user_2",
            due_date: null,
            instruction: "Old",
            instruction_updated_at: new Date("2026-05-05T10:00:00Z"),
            instruction_context: { integrations: ["okta"] },
          },
        ] as never
      );

    const app = buildApp("OrgAdmin", "growth");
    const res = await app.inject({ method: "GET", url: "/v1/controls/ctrl1" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { instructionRegenerated?: boolean } };
    expect(body.data.instructionRegenerated).toBe(true);
    expect(String(vi.mocked(prisma.$executeRawUnsafe).mock.calls.map((c) => c[0]).join("\n"))).toContain(
      "UPDATE \"tenant_"
    );
    expect(prisma.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "control.task_instruction_regenerated",
        }) as Record<string, unknown>,
      })
    );
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
            assigned_to: "user_1",
            updated_at: new Date("2026-05-05T10:00:00Z"),
            framework: "SOC2",
            framework_refs: ["SOC2:CC1"],
          },
          {
            id: "b",
            canonical_id: "c2",
            name: "Test2",
            domain: "D",
            status: "pending",
            assigned_to: null,
            updated_at: new Date("2026-05-05T11:00:00Z"),
            framework: "SOC2",
            framework_refs: ["SOC2:CC2"],
          },
        ] as never
      );

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/controls?limit=1" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        total: number;
        items: Array<{ assignedTo?: string | null; updatedAt?: string | null }>;
        nextCursor: string | null;
      };
    };
    expect(body.data.total).toBe(2);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.nextCursor).toBe("a");
    expect(body.data.items[0]?.assignedTo).toBe("user_1");
    expect(body.data.items[0]?.updatedAt).toBe("2026-05-05T10:00:00.000Z");
    await app.close();
  });
});

describe("PATCH /v1/controls/:id", () => {
  it("returns 400 when body is invalid", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/controls/a",
      payload: { assignToSelf: false },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 404 when control is missing", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([] as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/controls/missing",
      payload: { assignToSelf: true },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("assigns to self when body is valid", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ id: "a" }] as never)
      .mockResolvedValueOnce([{ onboarding_first_report_completed_at: null }] as never)
      .mockResolvedValueOnce([{ ok: false }] as never)
      .mockResolvedValueOnce([{ ok: false }] as never)
      .mockResolvedValueOnce([{ ok: false }] as never)
      .mockResolvedValueOnce([{ ok: false }] as never);
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/controls/a",
      payload: { assignToSelf: true },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { id: string; assignedTo: string } };
    expect(body.data.id).toBe("a");
    expect(body.data.assignedTo).toBe("user_1");
    await app.close();
  });
});

describe("POST /v1/controls/:id/assign", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = buildApp("AuditDirector");
    // Simulate unauthenticated: role is present but userId missing
    app.addHook("preHandler", async (request) => {
      request.user = { ...(request.user as UserContext), userId: "" };
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/controls/a/assign",
      payload: { assignedTo: "user_2", dueDate: "2026-06-01" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("returns 403 for ControlOwner role", async () => {
    const app = buildApp("ControlOwner");
    const res = await app.inject({
      method: "POST",
      url: "/v1/controls/a/assign",
      payload: { assignedTo: "user_2" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("returns 404 when control missing", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never) // integrations
      .mockResolvedValueOnce([{ id: "user_2" }] as never) // assigned user exists
      .mockResolvedValueOnce([] as never); // control row missing

    const app = buildApp("AuditDirector");
    const res = await app.inject({
      method: "POST",
      url: "/v1/controls/missing/assign",
      payload: { assignedTo: "user_2" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("returns 200 and writes audit log on success", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ provider: "okta" }, { provider: "aws" }] as never) // integrations
      .mockResolvedValueOnce([{ id: "user_2" }] as never) // assigned user exists
      .mockResolvedValueOnce(
        [
          {
            id: "a",
            canonical_id: "c1",
            name: "Logical access",
            domain: "Access Control",
            framework_refs: ["SOC2:CC6.1"],
          },
        ] as never
      ); // control row
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(1 as never);

    const app = buildApp("AuditDirector");
    const res = await app.inject({
      method: "POST",
      url: "/v1/controls/a/assign",
      payload: { assignedTo: "user_2", dueDate: "2026-06-01" },
    });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as {
      data: {
        id: string;
        assignedTo: string;
        dueDate: string | null;
        status: string;
        instruction: string;
        integrationsUsed: string[];
      };
    };
    expect(body.data.id).toBe("a");
    expect(body.data.assignedTo).toBe("user_2");
    expect(body.data.dueDate).toBe("2026-06-01");
    expect(body.data.status).toBe("in_review");
    expect(body.data.instruction.length).toBeGreaterThan(0);
    expect(body.data.integrationsUsed).toEqual(["aws", "okta"]);

    expect(prisma.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "control.assigned",
          resourceType: "control_item",
          resourceId: "a",
          tenantId: TENANT_ID,
          actorId: "user_1",
        }) as Record<string, unknown>,
      })
    );

    await app.close();
  });
});
