import { describe, it, expect } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { UserContext, TenantContext } from "@grc/types";
import { requireRole, requireTier } from "./rbac.js";

function buildApp(role: string, tier: string): FastifyInstance {
  const app = Fastify({ logger: false });

  app.addHook("preHandler", async (request) => {
    (request as unknown as { user: UserContext }).user = {
      userId: "user_1",
      orgId: "org_1",
      role: role as UserContext["role"],
      sessionId: "sess_1",
    };
    (request as unknown as { tenant: TenantContext }).tenant = {
      tenantId: "org_1",
      tier: tier as TenantContext["tier"],
      schemaName: "tenant_org1",
    };
  });

  app.get("/test-role", { preHandler: requireRole("AuditDirector") }, async () => ({ ok: true }));
  app.get("/test-tier", { preHandler: requireTier("growth") }, async () => ({ ok: true }));

  return app;
}

describe("requireRole()", () => {
  it("returns 403 when ControlOwner tries to access AuditDirector route", async () => {
    const app = buildApp("ControlOwner", "starter");
    const res = await app.inject({ method: "GET", url: "/test-role" });
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { code: string } }>().error.code).toBe("FORBIDDEN");
  });

  it("returns 403 for ReadOnly accessing AuditDirector route", async () => {
    const app = buildApp("ReadOnly", "starter");
    const res = await app.inject({ method: "GET", url: "/test-role" });
    expect(res.statusCode).toBe(403);
  });

  it("allows OrgAdmin on AuditDirector route", async () => {
    const app = buildApp("OrgAdmin", "starter");
    const res = await app.inject({ method: "GET", url: "/test-role" });
    expect(res.statusCode).toBe(200);
  });

  it("allows AuditDirector on AuditDirector route", async () => {
    const app = buildApp("AuditDirector", "starter");
    const res = await app.inject({ method: "GET", url: "/test-role" });
    expect(res.statusCode).toBe(200);
  });

  it("allows PlatformSuperAdmin on any role route", async () => {
    const app = buildApp("PlatformSuperAdmin", "starter");
    const res = await app.inject({ method: "GET", url: "/test-role" });
    expect(res.statusCode).toBe(200);
  });
});

describe("requireTier()", () => {
  it("returns 402 when starter tenant tries to access growth route", async () => {
    const app = buildApp("OrgAdmin", "starter");
    const res = await app.inject({ method: "GET", url: "/test-tier" });
    expect(res.statusCode).toBe(402);
    expect(res.json<{ error: { code: string } }>().error.code).toBe("TIER_LIMIT_EXCEEDED");
  });

  it("allows growth tenant on growth route", async () => {
    const app = buildApp("OrgAdmin", "growth");
    const res = await app.inject({ method: "GET", url: "/test-tier" });
    expect(res.statusCode).toBe(200);
  });

  it("allows scale tenant on growth route", async () => {
    const app = buildApp("OrgAdmin", "scale");
    const res = await app.inject({ method: "GET", url: "/test-tier" });
    expect(res.statusCode).toBe(200);
  });
});
