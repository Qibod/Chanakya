import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { UserContext } from "@grc/types";

const connect = vi.fn();
const subscribe = vi.fn();
const unsubscribe = vi.fn();
const quit = vi.fn();
const on = vi.fn();
const removeListener = vi.fn();

vi.mock("../../lib/redis-subscriber.js", () => ({
  createRedisSubscriber: () => ({
    connect,
    subscribe,
    unsubscribe,
    quit,
    on,
    removeListener,
  }),
}));

import { streamRoutes } from "./stream.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const SCHEMA = `tenant_${TENANT_ID.replace(/-/g, "")}`;

function buildApp(role: UserContext["role"]): FastifyInstance {
  const app = Fastify({ logger: false });
  app.decorateRequest("user", null as unknown as UserContext);
  app.decorateRequest("tenant", null as never);
  app.addHook("preHandler", async (request) => {
    request.user = { userId: "user_1", orgId: TENANT_ID, role, sessionId: "sess_1" };
    request.tenant = { tenantId: TENANT_ID, tier: "starter", schemaName: SCHEMA };
  });
  app.register(streamRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  connect.mockResolvedValue(undefined);
  subscribe.mockResolvedValue(1);
  unsubscribe.mockResolvedValue(1);
  quit.mockResolvedValue("OK");
});

describe("GET /v1/stream/control-health", () => {
  it("subscribes to tenant control-health channel", async () => {
    const app = buildApp("AuditDirector");
    // Force subscribe() to fail so the handler returns (SSE normally stays open).
    subscribe.mockRejectedValueOnce(new Error("stop"));
    const res = await app.inject({
      method: "GET",
      url: "/v1/stream/control-health",
      headers: { accept: "text/event-stream" },
    });
    expect(subscribe).toHaveBeenCalledWith(`tenant:${TENANT_ID}:control-health`);
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("rejects when role is insufficient", async () => {
    const app = buildApp("ControlOwner");
    const res = await app.inject({ method: "GET", url: "/v1/stream/control-health" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

