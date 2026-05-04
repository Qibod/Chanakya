import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { UserContext } from "@grc/types";

vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: vi.fn().mockReturnValue({
    userId: "user_admin",
    orgId: "org_test123",
    sessionId: "sess_1",
  }),
}));

vi.mock("@clerk/backend", () => ({
  createClerkClient: vi.fn().mockReturnValue({
    sessions: {
      getSessionList: vi.fn().mockResolvedValue({ data: [] }),
      revokeSession: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

vi.mock("@grc/db", () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn(),
  },
  tenantSchemaName: (id: string) => `tenant_${id.replace(/-/g, "")}`,
}));

vi.mock("../plugins/redis.js", () => ({
  redis: { del: vi.fn().mockResolvedValue(1) },
  default: async () => {},
}));

import { createClerkClient } from "@clerk/backend";
import { getAuth } from "@clerk/fastify";
import { prisma } from "@grc/db";
import { redis } from "../plugins/redis.js";
import { userRoutes } from "./users.js";

const TENANT_ID = "org_test123";
const TARGET_USER = "user_target";

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(userRoutes);
  return app;
}

function setupDbMock(role: UserContext["role"]) {
  vi.mocked(prisma.$queryRawUnsafe)
    .mockResolvedValueOnce([{ tier: "growth" }] as never)
    .mockResolvedValueOnce([{ role }] as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env["CLERK_SECRET_KEY"] = "sk_test_secret";
  vi.mocked(getAuth).mockReturnValue({
    userId: "user_admin",
    orgId: TENANT_ID,
    sessionId: "sess_1",
  } as ReturnType<typeof getAuth>);
  vi.mocked(createClerkClient).mockReturnValue({
    sessions: {
      getSessionList: vi.fn().mockResolvedValue({ data: [{ id: "sess_active" }] }),
      revokeSession: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as ReturnType<typeof createClerkClient>);
  vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(1 as never);
  vi.mocked(redis.del).mockResolvedValue(1);
});

describe("DELETE /v1/users/:userId", () => {
  it("returns 403 when caller is ControlOwner (not OrgAdmin)", async () => {
    setupDbMock("ControlOwner");
    const app = buildApp();
    const res = await app.inject({ method: "DELETE", url: `/v1/users/${TARGET_USER}` });
    expect(res.statusCode).toBe(403);
  });

  it("deactivates user: revokes Clerk sessions, marks inactive, flushes Redis", async () => {
    setupDbMock("OrgAdmin");
    const app = buildApp();
    const res = await app.inject({ method: "DELETE", url: `/v1/users/${TARGET_USER}` });
    expect(res.statusCode).toBe(204);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("active = FALSE"),
      TARGET_USER
    );
    expect(redis.del).toHaveBeenCalledWith(`rbac:${TENANT_ID}:${TARGET_USER}`);
  });

  it("still returns 204 when user has no active sessions", async () => {
    setupDbMock("OrgAdmin");
    vi.mocked(createClerkClient).mockReturnValue({
      sessions: {
        getSessionList: vi.fn().mockResolvedValue({ data: [] }),
        revokeSession: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as ReturnType<typeof createClerkClient>);
    const app = buildApp();
    const res = await app.inject({ method: "DELETE", url: `/v1/users/${TARGET_USER}` });
    expect(res.statusCode).toBe(204);
  });
});
