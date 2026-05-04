import fp from "fastify-plugin";
import Redis from "ioredis";
import type { FastifyPluginAsync } from "fastify";

export const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});

// Suppress unhandled error events when Redis is unavailable in dev/test
redis.on("error", () => {});

const redisPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
});

export default redisPlugin;
