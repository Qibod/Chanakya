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

const { redisGet, redisSet } = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
}));

vi.mock("../../plugins/redis.js", () => ({
  redis: {
    get: redisGet,
    set: redisSet,
  },
}));

vi.mock("@grc/db", () => {
  const prisma = {
    $queryRawUnsafe: vi.fn(),
  };
  return { prisma };
});

import { prisma } from "@grc/db";
import { dashboardRoutes } from "./dashboard.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const SCHEMA = `tenant_${TENANT_ID.replace(/-/g, "")}`;

function buildApp(role: UserContext["role"] = "AuditDirector"): FastifyInstance {
  const app = Fastify({ logger: false });
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
  app.register(dashboardRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  redisGet.mockResolvedValue(null);
  redisSet.mockResolvedValue("OK");
});

describe("GET /v1/dashboard", () => {
  it("returns dashboard read model and caches it in redis", async () => {
    (vi.mocked(prisma.$queryRawUnsafe) as unknown as {
      mockImplementation: (fn: (...args: any[]) => any) => void;
    }).mockImplementation(async (sql: string, ..._args: any[]) => {
      if (sql.includes(".control_health_snapshots")) {
        return [];
      }
      if (sql.includes("LIMIT 20")) {
        return [];
      }
      if (sql.includes("LIMIT 1")) {
        return [];
      }
      // Summary query: id, domain, status
      return [
        { id: "c1", domain: "Access Control", status: "fail" },
        { id: "c2", domain: "Access Control", status: "pass" },
        { id: "c3", domain: "Change Mgmt", status: "warn" },
      ];
    });

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/dashboard" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { summary: { passing: number; attention: number; failing: number } };
    };
    expect(body.data.summary.passing).toBe(1);
    expect(body.data.summary.attention).toBe(1);
    expect(body.data.summary.failing).toBe(1);
    expect(redisSet).toHaveBeenCalled();
    await app.close();
  });

  it("serves from redis cache when available", async () => {
    redisGet.mockResolvedValueOnce(
      JSON.stringify({
        summary: { passing: 1, attention: 0, failing: 0, passingDeltaWeek: 0, trajectoryScore: null },
        domains: [],
        feed: [],
      })
    );

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/dashboard" });
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(prisma.$queryRawUnsafe)).not.toHaveBeenCalled();
    await app.close();
  });
});

