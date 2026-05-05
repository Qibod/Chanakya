import type { FastifyRequest } from "fastify";

/**
 * Resolves the client IP for **audit logs only**.
 *
 * Uses Fastify {@link FastifyRequest.ip} when the server is built with `trustProxy: true`
 * (see `server.ts`), so the value reflects the **trusted** proxy chain — never parse raw
 * `X-Forwarded-For` from the client (spoofable).
 *
 * Falls back to `socket.remoteAddress` for local/dev requests without a forwarded chain.
 */
export function auditIpFromRequest(request: FastifyRequest): string | undefined {
  const ip = request.ip;
  if (typeof ip === "string" && ip.length > 0) {
    return ip;
  }
  const sock = request.socket?.remoteAddress;
  if (typeof sock === "string" && sock.length > 0) {
    return sock;
  }
  return undefined;
}
