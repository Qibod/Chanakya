import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireRole, requireTier } from "../../middleware/rbac.js";
import { createRedisSubscriber } from "../../lib/redis-subscriber.js";
import { redis } from "../../plugins/redis.js";

/**
 * SSE subscription for async job events on `tenant:{tenantId}:job:{jobId}`.
 * Event payload shape: `{ event, data: { tenantId, payload, timestamp } }` (architecture envelope).
 */
const fingerprintStreamPreHandlers = [requireTier("starter"), requireRole("ControlOwner")];
const controlHealthStreamPreHandlers = [requireTier("starter"), requireRole("AuditDirector")];
const DASHBOARD_CACHE_PREFIX = "grc:dashboard:";

export async function streamRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/v1/stream/jobs/:jobId",
    {
      preHandler: fingerprintStreamPreHandlers,
    },
    async (request, reply) => {
      const { jobId } = (request as FastifyRequest<{ Params: { jobId: string } }>).params;
      const tenantId = request.tenant.tenantId;
      if (!jobId.startsWith(`${tenantId}.fingerprint.`)) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Job does not belong to this tenant" },
        });
      }

      const channel = `tenant:${tenantId}:job:${jobId}`;
      const sub = createRedisSubscriber();

      try {
        await sub.connect();
      } catch (err) {
        fastify.log.error({ err }, "Redis subscriber connect failed");
        return reply.code(503).send({
          error: {
            code: "STREAM_UNAVAILABLE",
            message: "Real-time stream unavailable",
          },
        });
      }

      const onMessage = (_ch: string, message: string) => {
        try {
          const parsed = JSON.parse(message) as {
            event?: string;
            data?: { tenantId?: string; payload?: unknown; timestamp?: string };
          };
          const ev = parsed.event ?? "message";
          const dataStr = JSON.stringify(
            parsed.data ?? {
              tenantId,
              payload: {},
              timestamp: new Date().toISOString(),
            }
          );
          reply.raw.write(`event: ${ev}\ndata: ${dataStr}\n\n`);
        } catch (err) {
          fastify.log.warn({ err }, "Malformed pub/sub message");
        }
      };

      sub.on("message", onMessage);
      try {
        await sub.subscribe(channel);
      } catch (err) {
        sub.removeListener("message", onMessage);
        sub.quit().catch(() => {});
        fastify.log.error({ err }, "Redis subscribe failed");
        return reply.code(503).send({
          error: {
            code: "STREAM_UNAVAILABLE",
            message: "Real-time stream unavailable",
          },
        });
      }

      // Start streaming only after subscription succeeded.
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const heartbeat = setInterval(() => {
        reply.raw.write(`: ping\n\n`);
      }, 25_000);

      await new Promise<void>((resolve) => {
        const cleanup = () => {
          clearInterval(heartbeat);
          sub.removeListener("message", onMessage);
          sub.unsubscribe(channel).catch(() => {});
          sub.quit().catch(() => {});
          resolve();
        };
        request.raw.on("close", cleanup);
        request.raw.on("error", cleanup);
      });

      return reply;
    }
  );

  /**
   * Tenant-scoped SSE for control health events on `tenant:{tenantId}:control-health`.
   * Expected events include: `control.degraded`, `control.passed`.
   * Data payload shape: `{ tenantId, payload, timestamp }`.
   */
  fastify.get(
    "/v1/stream/control-health",
    {
      preHandler: controlHealthStreamPreHandlers,
    },
    async (request, reply) => {
      const tenantId = request.tenant.tenantId;
      const channel = `tenant:${tenantId}:control-health`;
      const dashboardCacheKey = `${DASHBOARD_CACHE_PREFIX}${tenantId}`;
      const sub = createRedisSubscriber();

      try {
        await sub.connect();
      } catch (err) {
        fastify.log.error({ err }, "Redis subscriber connect failed");
        return reply.code(503).send({
          error: {
            code: "STREAM_UNAVAILABLE",
            message: "Real-time stream unavailable",
          },
        });
      }

      const onMessage = async (_ch: string, message: string) => {
        try {
          const parsed = JSON.parse(message) as {
            event?: string;
            data?: { tenantId?: string; payload?: unknown; timestamp?: string };
          };
          const ev = parsed.event ?? "message";

          if (ev === "control.degraded" || ev === "control.passed") {
            await redis.del(dashboardCacheKey);
          }

          const dataStr = JSON.stringify(
            parsed.data ?? {
              tenantId,
              payload: {},
              timestamp: new Date().toISOString(),
            }
          );
          reply.raw.write(`event: ${ev}\ndata: ${dataStr}\n\n`);
        } catch (err) {
          fastify.log.warn({ err }, "Malformed pub/sub message");
        }
      };

      sub.on("message", onMessage);
      try {
        await sub.subscribe(channel);
      } catch (err) {
        sub.removeListener("message", onMessage);
        sub.quit().catch(() => {});
        fastify.log.error({ err }, "Redis subscribe failed");
        return reply.code(503).send({
          error: {
            code: "STREAM_UNAVAILABLE",
            message: "Real-time stream unavailable",
          },
        });
      }

      // Start streaming only after subscription succeeded.
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const heartbeat = setInterval(() => {
        reply.raw.write(`: ping\n\n`);
      }, 25_000);

      await new Promise<void>((resolve) => {
        const cleanup = () => {
          clearInterval(heartbeat);
          sub.removeListener("message", onMessage);
          sub.unsubscribe(channel).catch(() => {});
          sub.quit().catch(() => {});
          resolve();
        };
        request.raw.on("close", cleanup);
        request.raw.on("error", cleanup);
      });

      return reply;
    }
  );
}
