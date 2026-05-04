import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import rawBody from "fastify-raw-body";

// Mock svix Webhook
vi.mock("svix", () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn(),
  })),
}));

// Mock @grc/db
vi.mock("@grc/db", () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  },
  provisionTenantSchema: vi.fn().mockResolvedValue(undefined),
  tenantSchemaName: (id: string) => `tenant_${id.replace(/-/g, "")}`,
}));

// Mock Redis plugin
vi.mock("../../plugins/redis.js", () => ({
  redis: { del: vi.fn().mockResolvedValue(1) },
  default: async () => {},
}));

import { Webhook } from "svix";
import { prisma, provisionTenantSchema } from "@grc/db";
import { redis } from "../../plugins/redis.js";
import { clerkWebhookRoutes } from "./clerk.js";

const mockVerify = vi.fn();
vi.mocked(Webhook).mockImplementation(() => ({ verify: mockVerify }) as unknown as InstanceType<typeof Webhook>);

const SVIX_HEADERS = {
  "svix-id": "msg_test",
  "svix-timestamp": "1234567890",
  "svix-signature": "v1,test",
  "content-type": "application/json",
};

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(rawBody, { field: "rawBody", global: false, encoding: "utf8", runFirst: true });
  app.register(clerkWebhookRoutes);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env["CLERK_WEBHOOK_SIGNING_SECRET"] = "whsec_test_secret";
  vi.mocked(Webhook).mockImplementation(() => ({ verify: mockVerify }) as unknown as InstanceType<typeof Webhook>);
  vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(1 as never);
  vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([] as never);
  vi.mocked(provisionTenantSchema).mockResolvedValue(undefined);
  vi.mocked(redis.del).mockResolvedValue(1);
});

const ORG_ID = "org_test123";
const USER_ID = "user_abc";

describe("POST /webhooks/clerk", () => {
  it("returns 400 when svix headers are missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/clerk",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "organization.created", data: {} }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    mockVerify.mockImplementation(() => {
      throw new Error("invalid signature");
    });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/clerk",
      headers: SVIX_HEADERS,
      body: JSON.stringify({ type: "organization.created", data: {} }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { code: string } }>().error.code).toBe("INVALID_SIGNATURE");
  });

  it("handles organization.created: provisions schema and inserts tenant row", async () => {
    const payload = {
      type: "organization.created",
      data: { id: ORG_ID, name: "Acme Corp" },
    };
    mockVerify.mockReturnValue(payload);
    const app = buildApp();
    const body = JSON.stringify(payload);
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/clerk",
      headers: SVIX_HEADERS,
      body,
    });
    expect(res.statusCode).toBe(200);
    expect(provisionTenantSchema).toHaveBeenCalledWith(ORG_ID);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO"),
      ORG_ID,
      "Acme Corp"
    );
  });

  it("handles organizationMembership.created: upserts user + role_assignments + user_tenant_map", async () => {
    const payload = {
      type: "organizationMembership.created",
      data: {
        organization: { id: ORG_ID },
        public_user_data: {
          user_id: USER_ID,
          identifier: "alice@example.com",
          first_name: "Alice",
          last_name: "Smith",
        },
      },
    };
    mockVerify.mockReturnValue(payload);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/clerk",
      headers: SVIX_HEADERS,
      body: JSON.stringify(payload),
    });
    expect(res.statusCode).toBe(200);
    const calls = vi.mocked(prisma.$executeRawUnsafe).mock.calls;
    expect(calls.some((c) => (c[0] as string).includes("INSERT INTO") && (c[0] as string).includes("users"))).toBe(true);
    expect(calls.some((c) => (c[0] as string).includes("role_assignments"))).toBe(true);
    expect(calls.some((c) => (c[0] as string).includes("user_tenant_map"))).toBe(true);
  });

  it("handles organizationMembership.deleted: deletes role_assignments and flushes Redis", async () => {
    const payload = {
      type: "organizationMembership.deleted",
      data: {
        organization: { id: ORG_ID },
        public_user_data: { user_id: USER_ID },
      },
    };
    mockVerify.mockReturnValue(payload);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/clerk",
      headers: SVIX_HEADERS,
      body: JSON.stringify(payload),
    });
    expect(res.statusCode).toBe(200);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM"),
      USER_ID
    );
    expect(redis.del).toHaveBeenCalledWith(`rbac:${ORG_ID}:${USER_ID}`);
  });

  it("handles user.deleted: marks user inactive and flushes Redis for each tenant", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([{ tenant_id: ORG_ID }] as never);
    const payload = {
      type: "user.deleted",
      data: { id: USER_ID },
    };
    mockVerify.mockReturnValue(payload);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/clerk",
      headers: SVIX_HEADERS,
      body: JSON.stringify(payload),
    });
    expect(res.statusCode).toBe(200);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("active = FALSE"),
      USER_ID
    );
    expect(redis.del).toHaveBeenCalledWith(`rbac:${ORG_ID}:${USER_ID}`);
  });

  it("returns 200 for unhandled event types (graceful no-op)", async () => {
    const payload = { type: "session.created", data: {} };
    mockVerify.mockReturnValue(payload);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/clerk",
      headers: SVIX_HEADERS,
      body: JSON.stringify(payload),
    });
    expect(res.statusCode).toBe(200);
  });
});
