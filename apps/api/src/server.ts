import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { tenantMiddleware } from "./middleware/tenant.js";

const fastify = Fastify({
  logger: {
    level: process.env["LOG_LEVEL"] ?? "info",
    transport:
      process.env["NODE_ENV"] === "development"
        ? { target: "pino-pretty" }
        : undefined,
  },
});

async function buildServer() {
  // Plugins
  await fastify.register(cors, {
    origin: process.env["ALLOWED_ORIGINS"]?.split(",") ?? ["http://localhost:3000"],
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Health check — no tenant context required
  fastify.get("/health", async () => ({ status: "ok", version: "1.0.0" }));

  // Tenant middleware applied to all /v1/* routes (ARCH-2)
  // TODO Story 1.3: tenant resolution moves to JWT extraction; hook remains
  fastify.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/v1/")) {
      return tenantMiddleware(request, reply);
    }
  });

  // Routes registered in subsequent stories (1.3–1.6)
  // fastify.register(controlsRoutes, { prefix: "/v1" });

  return fastify;
}

async function start() {
  try {
    const server = await buildServer();
    const port = Number(process.env["PORT"] ?? 3001);
    await server.listen({ port, host: "0.0.0.0" });
    console.log(`API server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

export { buildServer };
