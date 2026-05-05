import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TenantContext, UserContext } from "@grc/types";

vi.mock("@grc/ai", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  const stripCodesAndJargon = (text: string): string => {
    return text
      .replace(/\bSOC2:\s*[A-Z0-9.\-]+\b/gi, "")
      .replace(/\bISO27001:\s*[A-Z0-9.\-]+\b/gi, "")
      .replace(/\bCC\d+(\.\d+)?\b/gi, "")
      .replace(/\bA\.\d+(\.\d+)*\b/gi, "")
      .replace(/\battestation\b/gi, "confirmation")
      .replace(/\boperating effectiveness\b/gi, "day-to-day effectiveness")
      .replace(/\bcontrol objective\b/gi, "goal")
      .replace(/\bworkpaper(s)?\b/gi, "record")
      .replace(/\s{2,}/g, " ")
      .trim();
  };
  return {
    ...actual,
    stripCodesAndJargon,
    VertexAIProvider: class VertexAIProvider {
      async complete() {
        return {
          content: "This supports SOC2:CC6.1. It helps confirm access is correct. Auditors will review it.",
          model: "claude-sonnet-4-6",
          inputTokens: 1,
          outputTokens: 1,
        };
      }
    },
    generateWhyNeeded: async () =>
      "It helps keep access correct and reduces surprises. It also creates a clear record of what was checked.",
  };
});

vi.mock("@grc/evidence-ingestion", () => ({
  createBlobStorageFromEnv: vi.fn(() => ({
    putObject: vi.fn(),
    readObjectFull: vi.fn(),
  })),
  getEffectiveEvidenceBucketName: vi.fn(() => "test-bucket"),
  getEvidenceBucketName: vi.fn(() => "test-bucket"),
  submitControlOwnerNoteEvidence: vi.fn().mockResolvedValue({ evidenceItemId: "ev1" }),
}));

vi.mock("@grc/db", () => {
  const prisma = {
    $queryRawUnsafe: vi.fn(),
  };
  return { prisma };
});

import { prisma } from "@grc/db";
import { myTasksRoutes } from "./my-tasks.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const SCHEMA = `tenant_${TENANT_ID.replace(/-/g, "")}`;

function buildApp(
  role: UserContext["role"] = "ControlOwner",
  tenantOverrides: Partial<TenantContext> = {}
): FastifyInstance {
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
      ...tenantOverrides,
    } as TenantContext;
  });
  app.register(myTasksRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /v1/my-tasks", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = buildApp("ControlOwner");
    app.addHook("preHandler", async (request) => {
      request.user = { ...(request.user as UserContext), userId: "" };
    });

    const res = await app.inject({ method: "GET", url: "/v1/my-tasks" });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body) as { error?: { code?: string } };
    expect(body.error?.code).toBe("UNAUTHENTICATED");
    await app.close();
  });

  it("returns 403 for non-ControlOwner role", async () => {
    const app = buildApp("AuditDirector");
    const res = await app.inject({ method: "GET", url: "/v1/my-tasks" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("returns 402 when tenant tier is below starter requirement", async () => {
    const app = buildApp("ControlOwner", { tier: undefined as unknown as TenantContext["tier"] });
    const res = await app.inject({ method: "GET", url: "/v1/my-tasks" });
    expect(res.statusCode).toBe(402);
    const body = JSON.parse(res.body) as { error?: { code?: string } };
    expect(body.error?.code).toBe("TIER_LIMIT_EXCEEDED");
    await app.close();
  });

  it("returns read model without compliance codes in payload", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce(
      [
        {
          control_id: "c1",
          control_name: "AWS IAM access review",
          domain: "Access Control",
          control_status: "fail",
          due_date: "2026-06-01",
        },
        {
          control_id: "c2",
          control_name: "Okta user offboarding",
          domain: "Identity",
          control_status: "auto",
          due_date: null,
        },
      ] as never
    );

    const app = buildApp("ControlOwner");
    const res = await app.inject({ method: "GET", url: "/v1/my-tasks" });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as {
      data: {
        summary: { taskCount: number; automatedCount: number };
        tasks: Array<{
          controlId: string;
          title: string;
          description: string;
          dueDate: string | null;
          status: "todo" | "complete";
        }>;
      };
    };

    expect(body.data.summary.taskCount).toBe(1);
    expect(body.data.summary.automatedCount).toBe(1);
    expect(body.data.tasks).toHaveLength(1);
    expect(body.data.tasks[0]?.controlId).toBe("c1");
    expect(body.data.tasks[0]?.dueDate).toBe("2026-06-01");

    const payload = JSON.stringify(body);
    expect(payload).not.toMatch(/SOC2:|ISO27001:|CC\d|A\.\d/i);
    await app.close();
  });

  it("strips compliance-like tokens from control names in title and description", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce(
      [
        {
          control_id: "c1",
          assignment_id: "as1",
          control_name: "Access review SOC2:CC6.1",
          domain: "Access Control",
          control_status: "fail",
          due_date: "2026-06-01",
          completed_at: null,
        },
      ] as never
    );

    const app = buildApp("ControlOwner");
    const res = await app.inject({ method: "GET", url: "/v1/my-tasks" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { tasks: Array<{ title: string; description: string }> };
    };
    expect(body.data.tasks[0]?.title).toMatch(/Review:/);
    expect(body.data.tasks[0]?.title).not.toMatch(/SOC2:|CC\d/i);
    expect(body.data.tasks[0]?.description).not.toMatch(/SOC2:|CC\d/i);
    await app.close();
  });
});

describe("POST /v1/my-tasks/:controlId/why-needed", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = buildApp("ControlOwner");
    app.addHook("preHandler", async (request) => {
      request.user = { ...(request.user as UserContext), userId: "" };
    });

    const res = await app.inject({ method: "POST", url: "/v1/my-tasks/c1/why-needed" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("returns 403 for non-ControlOwner role", async () => {
    const app = buildApp("AuditDirector");
    const res = await app.inject({ method: "POST", url: "/v1/my-tasks/c1/why-needed" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("returns plain-English explanation without compliance codes", async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ id: "c1", name: "AWS IAM access review", domain: "Access Control" }] as never)
      .mockResolvedValueOnce([{ provider: "aws" }] as never);

    const app = buildApp("ControlOwner");
    const res = await app.inject({ method: "POST", url: "/v1/my-tasks/c1/why-needed" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { text: string; generatedAt: string } };
    expect(body.data.text.length).toBeGreaterThan(0);
    expect(body.data.text).not.toMatch(/SOC2:|ISO27001:|CC\d|A\.\d/i);
    expect(body.data.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await app.close();
  });
});

describe("POST /v1/my-tasks/:controlId/complete", () => {
  it("returns 400 when evidence missing", async () => {
    const app = buildApp("ControlOwner");
    const res = await app.inject({
      method: "POST",
      url: "/v1/my-tasks/c1/complete",
      payload: { evidenceText: "" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 403 when caller is not assignee", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([] as never);
    const app = buildApp("ControlOwner");
    const res = await app.inject({
      method: "POST",
      url: "/v1/my-tasks/c1/complete",
      payload: { evidenceText: "Reviewed and confirmed." },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("marks task complete and returns evidenceItemId", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ assignment_id: "as1" }] as never);

    const app = buildApp("ControlOwner");
    const res = await app.inject({
      method: "POST",
      url: "/v1/my-tasks/c1/complete",
      payload: { evidenceText: "Reviewed the user list and confirmed it is correct." },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { controlId: string; status: string; evidenceItemId: string } };
    expect(body.data.controlId).toBe("c1");
    expect(body.data.status).toBe("complete");
    expect(body.data.evidenceItemId).toBe("ev1");
    await app.close();
  });
});

