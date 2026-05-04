import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { tenantMiddleware } from "./tenant.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function buildTestApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.addHook("preHandler", tenantMiddleware);
  app.get("/v1/test", async (request) => ({
    tenantId: request.tenant.tenantId,
    schemaName: request.tenant.schemaName,
    tier: request.tenant.tier,
  }));
  return app;
}

describe("tenantMiddleware", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 400 when x-tenant-id header is missing", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/test" });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("TENANT_REQUIRED");
  });

  it("returns 400 when x-tenant-id is not a valid UUID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/test",
      headers: { "x-tenant-id": "not-a-uuid" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("TENANT_REQUIRED");
  });

  it("returns 400 for empty x-tenant-id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/test",
      headers: { "x-tenant-id": "" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("populates request.tenant with correct values for valid UUID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/test",
      headers: { "x-tenant-id": VALID_UUID },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      tenantId: string;
      schemaName: string;
      tier: string;
    }>();
    expect(body.tenantId).toBe(VALID_UUID);
    expect(body.schemaName).toBe("tenant_550e8400e29b41d4a716446655440000");
    expect(body.tier).toBe("starter");
  });

  it("is case-insensitive for UUID hex characters", async () => {
    const upperUuid = VALID_UUID.toUpperCase();
    const res = await app.inject({
      method: "GET",
      url: "/v1/test",
      headers: { "x-tenant-id": upperUuid },
    });
    expect(res.statusCode).toBe(200);
  });
});
