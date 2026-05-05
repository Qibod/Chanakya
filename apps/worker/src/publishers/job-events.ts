import { redis } from "../redis.js";

export type JobEventEnvelope = {
  event: string;
  data: {
    tenantId: string;
    payload: unknown;
    timestamp: string;
  };
};

export async function publishJobEvent(
  tenantId: string,
  jobId: string,
  envelope: JobEventEnvelope
): Promise<void> {
  const channel = `tenant:${tenantId}:job:${jobId}`;
  await redis.publish(channel, JSON.stringify(envelope));
}
