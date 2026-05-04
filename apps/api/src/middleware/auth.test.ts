import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

// Mock @clerk/fastify before importing the middleware
vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: vi.fn(),
}));

import { getAuth } from "@clerk/fastify";
import { authenticate } from "./auth.js";

const mockGetAuth = vi.mocked(getAuth);

function buildTestApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get("/test", { preHandler: authenticate }, async (req) => {
    return { userId: req.user.userId, orgId: req.user.orgId, role: req.user.role };
  });
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("authenticate middleware", () => {
  it("returns 401 when no active session", async () => {
    mockGetAuth.mockReturnValue({ userId: null, orgId: null, sessionId: null, isAuthenticated: false } as never);
    const app = buildTestApp();
    const res = await app.inject({ method: "GET", url: "/test" });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 when session exists but no orgId (user not in an organisation)", async () => {
    mockGetAuth.mockReturnValue({ userId: "user_123", orgId: null, sessionId: "sess_abc", isAuthenticated: true } as never);
    const app = buildTestApp();
    const res = await app.inject({ method: "GET", url: "/test" });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.code).toBe("UNAUTHENTICATED");
  });

  it("sets request.user on valid session with orgId", async () => {
    mockGetAuth.mockReturnValue({
      userId: "user_abc123",
      orgId: "org_tenant001",
      sessionId: "sess_xyz",
      isAuthenticated: true,
    } as never);
    const app = buildTestApp();
    const res = await app.inject({ method: "GET", url: "/test" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.userId).toBe("user_abc123");
    expect(body.orgId).toBe("org_tenant001");
    expect(body.role).toBe("ControlOwner");
  });
});
