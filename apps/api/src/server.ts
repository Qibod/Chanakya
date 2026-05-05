import "./instrument.js";

import Fastify from "fastify";
import * as Sentry from "@sentry/node";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { clerkPlugin } from "@clerk/fastify";
import rawBody from "fastify-raw-body";
import { authenticate } from "./middleware/auth.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import redisPlugin from "./plugins/redis.js";
import { clerkWebhookRoutes } from "./routes/webhooks/clerk.js";
import { userRoutes } from "./routes/users.js";
import { fingerprintRoutes } from "./routes/v1/fingerprint.js";
import { frameworkRoutes } from "./routes/v1/frameworks.js";
import { onboardingRoutes } from "./routes/v1/onboarding.js";
import { dashboardRoutes } from "./routes/v1/dashboard.js";
import { streamRoutes } from "./routes/v1/stream.js";
import { myTasksRoutes } from "./routes/v1/my-tasks.js";
import { gapsRoutes } from "./routes/v1/gaps.js";
import { evidenceItemRoutes } from "./routes/v1/evidence-items.js";
import { evidenceRoutes } from "./routes/v1/evidence.js";
import { adminRoutes } from "./routes/admin.js";

/** When true, `request.ip` uses the trusted proxy chain (e.g. Cloud Run / load balancer), not raw client XFF. */
const trustProxy =
  process.env["TRUST_PROXY"] === "true" || process.env["NODE_ENV"] === "production";

const fastify = Fastify({
  trustProxy,
  logger: {
    level: process.env["LOG_LEVEL"] ?? "info",
    ...(process.env["NODE_ENV"] === "development"
      ? { transport: { target: "pino-pretty" } }
      : {
          formatters: {
            level: (label: string) => ({ severity: label.toUpperCase() }),
          },
          messageKey: "message",
        }),
  },
});

async function buildServer() {
  // Register Sentry error handler before all plugins
  Sentry.setupFastifyErrorHandler(fastify);

  // Plugins
  await fastify.register(cors, {
    origin: process.env["ALLOWED_ORIGINS"]?.split(",") ?? ["http://localhost:3000"],
  });

  // Multipart uploads (Story 4.2)
  await fastify.register(multipart, {
    limits: {
      files: 1,
    },
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

  // authenticate → tenantMiddleware → tenant context binding for all /v1/* routes
  fastify.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/v1/")) {
      await authenticate(request, reply);
      if (!reply.sent) {
        await tenantMiddleware(request, reply);
        // Bind tenant + actor to the request logger for structured GCP Cloud Logging
        if (!reply.sent && request.tenant) {
          request.log = request.log.child({
            tenantId: request.tenant.tenantId,
            actor: request.user?.userId,
          });
        }
      }
    }
  });

  // Webhook routes — outside /v1/* auth chain (verified by svix signature)
  await fastify.register(clerkWebhookRoutes);

  // API routes
  await fastify.register(userRoutes);
  await fastify.register(fingerprintRoutes);
  await fastify.register(frameworkRoutes);
  await fastify.register(onboardingRoutes);
  await fastify.register(dashboardRoutes);
  await fastify.register(myTasksRoutes);
  await fastify.register(gapsRoutes);
  await fastify.register(evidenceItemRoutes);
  await fastify.register(evidenceRoutes);
  await fastify.register(streamRoutes);

  // Admin routes — gated by ADMIN_PROVISION_SECRET header, outside /v1/* auth chain
  await fastify.register(adminRoutes);

  return fastify;
}

async function start() {
  const required = ["CLERK_WEBHOOK_SIGNING_SECRET"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  try {
    const server = await buildServer();
    const port = Number(process.env["PORT"] ?? 3001);
    await server.listen({ port, host: "0.0.0.0" });
    server.log.info(`API server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

export { buildServer };
