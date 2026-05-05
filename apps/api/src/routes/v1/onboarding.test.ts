import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { UserContext } from "@grc/types";

vi.mock("../../services/onboarding-progress.js", () => ({
  computeOnboardingSteps: vi.fn().mockResolvedValue({
    steps: {
      fingerprint: true,
      framework: true,
      integration: false,
      assign_control: false,
      first_report: false,
    },
    completedCount: 2,
    allComplete: false,
  }),
  finalizeDismissIfComplete: vi.fn(),
}));

vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: vi.fn().mockReturnValue({
    userId: "user_1",
    orgId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    sessionId: "sess_1",
  }),
}));

vi.mock("@grc/db", () => {
  const prismaMock = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn(),
  };
  return { prisma: prismaMock };
});

import { prisma } from "@grc/db";
import { onboardingRoutes } from "./onboarding.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const SCHEMA = `tenant_${TENANT_ID.replace(/-/g, "")}`;

function buildApp(role: UserContext["role"] = "OrgAdmin"): FastifyInstance {
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
  app.register(onboardingRoutes);
  return app;
}

describe("GET /v1/onboarding/progress", () => {
  beforeEach(() => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
      { onboarding_dismissed_at: null },
    ] as never);
  });

  it("returns progress envelope", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/onboarding/progress" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { completedCount: number; total: number; dismissedAt: null };
    };
    expect(body.data.completedCount).toBe(2);
    expect(body.data.total).toBe(5);
    expect(body.data.dismissedAt).toBeNull();
    await app.close();
  });
});
