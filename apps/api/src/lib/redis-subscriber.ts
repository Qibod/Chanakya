import Redis from "ioredis";

/** Dedicated subscriber connection — required for pub/sub (cannot share with publisher commands). */
export function createRedisSubscriber(): Redis {
  return new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
  });
}
