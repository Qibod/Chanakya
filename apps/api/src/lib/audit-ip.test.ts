import { describe, it, expect } from "vitest";
import type { FastifyRequest } from "fastify";
import { auditIpFromRequest } from "./audit-ip.js";

describe("auditIpFromRequest", () => {
  it("prefers request.ip when set", () => {
    const req = {
      ip: "203.0.113.10",
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as FastifyRequest;
    expect(auditIpFromRequest(req)).toBe("203.0.113.10");
  });

  it("falls back to socket when ip empty", () => {
    const req = {
      ip: "",
      socket: { remoteAddress: "::1" },
    } as unknown as FastifyRequest;
    expect(auditIpFromRequest(req)).toBe("::1");
  });
});
