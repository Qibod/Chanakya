import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { UserContext } from "@grc/types";

vi.mock("@grc/db", () => {
  const prisma = {
    $queryRawUnsafe: vi.fn(),
  };
  return { prisma };
});

import { prisma } from "@grc/db";
import { gapsRoutes } from "./gaps.js";

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
  app.register(gapsRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /v1/gaps", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = buildApp("AuditDirector");
    app.addHook("preHandler", async (request) => {
      request.user = { ...(request.user as UserContext), userId: "" };
    });

    const res = await app.inject({ method: "GET", url: "/v1/gaps" });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body) as { error?: { code?: string } };
    expect(body.error?.code).toBe("UNAUTHENTICATED");
    await app.close();
  });

  it("returns 403 for non-AuditDirector role", async () => {
    const app = buildApp("ControlOwner");
    const res = await app.inject({ method: "GET", url: "/v1/gaps" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("returns only warn/fail items sorted fail-first then updatedAt desc", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce(
      [
        {
          id: "c2",
          name: "Change management",
          domain: "Operations",
          status: "fail",
          framework_refs: ["SOC2:CC8.1"],
          assigned_to: null,
          updated_at: new Date("2026-05-05T11:00:00Z"),
          due_date: "2026-06-01",
        },
        {
          id: "c1",
          name: "Access review",
          domain: "Access Control",
          status: "warn",
          framework_refs: ["SOC2:CC6.1", "ISO27001:A.9.2.1"],
          assigned_to: "user_2",
          updated_at: new Date("2026-05-05T10:00:00Z"),
          due_date: null,
        },
      ] as never
    );

    const app = buildApp("AuditDirector");
    const res = await app.inject({ method: "GET", url: "/v1/gaps" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        items: Array<{
          controlId: string;
          status: "warn" | "fail";
          frameworks: Array<{ key: string; name: string }>;
          updatedAt: string | null;
          dueDate: string | null;
        }>;
      };
    };

    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[0]?.controlId).toBe("c2");
    expect(body.data.items[0]?.status).toBe("fail");
    expect(body.data.items[1]?.controlId).toBe("c1");
    expect(body.data.items[1]?.status).toBe("warn");

    // Smoke: framework mapping derived from refs
    expect(body.data.items[1]?.frameworks.map((f) => f.key).sort()).toEqual(["ISO27001", "SOC2"]);
    expect(body.data.items[0]?.frameworks.map((f) => f.key)).toEqual(["SOC2"]);

    expect(body.data.items[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.data.items[0]?.dueDate).toBe("2026-06-01");
    await app.close();
  });
});

