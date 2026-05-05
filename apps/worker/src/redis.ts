import Redis from "ioredis";

export const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 2,
});

redis.on("error", () => {});
