import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireRole, requireTier } from "../../middleware/rbac.js";
import { createRedisSubscriber } from "../../lib/redis-subscriber.js";

/**
 * SSE subscription for async job events on `tenant:{tenantId}:job:{jobId}`.
 * Event payload shape: `{ event, data: { tenantId, payload, timestamp } }` (architecture envelope).
 */
const fingerprintStreamPreHandlers = [requireTier("starter"), requireRole("ControlOwner")];

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
      await sub.subscribe(channel);

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
