import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// Mock DB — tenant middleware does DB lookups for tier + role
vi.mock("@grc/db", () => ({
  tenantSchemaName: (id: string) => `tenant_${id.replace(/-/g, "")}`,
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

import { prisma } from "@grc/db";
import { tenantMiddleware } from "./tenant.js";
import type { UserContext } from "@grc/types";

const mockQuery = vi.mocked(prisma.$queryRawUnsafe);

const VALID_ORG_ID = "org_550e8400e29b41d4a716446655440000";
const VALID_USER_ID = "user_abc123";

function buildTestApp(userContext?: Partial<UserContext>): FastifyInstance {
  const app = Fastify({ logger: false });

  // Simulate authenticate middleware having run
  app.addHook("preHandler", async (request) => {
    if (userContext !== undefined) {
      (request as unknown as { user: UserContext }).user = {
        userId: VALID_USER_ID,
        orgId: VALID_ORG_ID,
        role: "ControlOwner",
        sessionId: "sess_test",
        ...userContext,
      } as UserContext;
    }
  });

  app.addHook("preHandler", tenantMiddleware);
  app.get("/v1/test", async (request) => ({
    tenantId: request.tenant.tenantId,
    schemaName: request.tenant.schemaName,
    tier: request.tenant.tier,
    role: request.user.role,
  }));
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
  // Default DB returns: tier=starter, role=ControlOwner
  mockQuery
    .mockResolvedValueOnce([{ tier: "starter" }])   // tenants table lookup
    .mockResolvedValueOnce([{ role: "AuditDirector" }]); // role_assignments lookup
});

describe("tenantMiddleware (JWT-based)", () => {
  it("returns 400 TENANT_REQUIRED when request.user is not set", async () => {
    const app = buildTestApp(undefined);
    const res = await app.inject({ method: "GET", url: "/v1/test" });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { code: string } }>().error.code).toBe("TENANT_REQUIRED");
  });

  it("returns 400 TENANT_REQUIRED when orgId is empty", async () => {
    const app = buildTestApp({ orgId: "" });
    const res = await app.inject({ method: "GET", url: "/v1/test" });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { code: string } }>().error.code).toBe("TENANT_REQUIRED");
  });

  it("populates request.tenant from request.user.orgId", async () => {
    const app = buildTestApp({});
    const res = await app.inject({ method: "GET", url: "/v1/test" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ tenantId: string; schemaName: string; tier: string; role: string }>();
    expect(body.tenantId).toBe(VALID_ORG_ID);
    expect(body.schemaName).toBe(`tenant_${VALID_ORG_ID.replace(/-/g, "")}`);
    expect(body.tier).toBe("starter");
  });

  it("updates request.user.role from DB lookup", async () => {
    const app = buildTestApp({});
    const res = await app.inject({ method: "GET", url: "/v1/test" });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ role: string }>().role).toBe("AuditDirector");
  });

  it("returns 503 TENANT_NOT_PROVISIONED when tenant not found in DB", async () => {
    mockQuery.mockReset();
    mockQuery
      .mockResolvedValueOnce([])  // no tenant row
      .mockResolvedValueOnce([]); // no role row
    const app = buildTestApp({});
    const res = await app.inject({ method: "GET", url: "/v1/test" });
    expect(res.statusCode).toBe(503);
    expect(res.json<{ error: { code: string } }>().error.code).toBe("TENANT_NOT_PROVISIONED");
  });

  it("defaults to ReadOnly role when no role assignment found", async () => {
    mockQuery.mockReset();
    mockQuery
      .mockResolvedValueOnce([{ tier: "growth" }])
      .mockResolvedValueOnce([]); // no role_assignments row
    const app = buildTestApp({});
    const res = await app.inject({ method: "GET", url: "/v1/test" });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ role: string }>().role).toBe("ReadOnly");
  });
});
