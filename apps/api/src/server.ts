import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { clerkPlugin } from "@clerk/fastify";
import rawBody from "fastify-raw-body";
import { authenticate } from "./middleware/auth.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import redisPlugin from "./plugins/redis.js";
import { clerkWebhookRoutes } from "./routes/webhooks/clerk.js";
import { userRoutes } from "./routes/users.js";

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

  // Clerk JWT verification
  await fastify.register(clerkPlugin);

  // Raw body for webhook signature verification (opt-in per route)
  await fastify.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  // Redis plugin (lazy-connect, no-op if Redis unavailable)
  await fastify.register(redisPlugin);

  // Health check — no auth required
  fastify.get("/health", async () => ({ status: "ok", version: "1.0.0" }));

  // authenticate → tenantMiddleware applied to all /v1/* routes
  fastify.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/v1/")) {
      await authenticate(request, reply);
      if (!reply.sent) {
        await tenantMiddleware(request, reply);
      }
    }
  });

  // Webhook routes — outside /v1/* auth chain (verified by svix signature)
  await fastify.register(clerkWebhookRoutes);

  // API routes
  await fastify.register(userRoutes);

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
