import { CloudTasksClient } from "@google-cloud/tasks";

export type FingerprintTaskPayload = {
  tenantId: string;
  schemaName: string;
  jobId: string;
  companyName: string;
};

function workerBaseUrl(): string {
  return process.env["WORKER_HTTP_URL"] ?? "http://localhost:3002";
}

/**
 * Delivers the fingerprint job to the worker: Cloud Tasks in GCP, or direct HTTP in dev / when SKIP_CLOUD_TASKS=true.
 */
export async function deliverFingerprintTask(payload: FingerprintTaskPayload): Promise<void> {
  const body = JSON.stringify(payload);
  const secret = process.env["WORKER_INVOCATION_SECRET"];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Job-Type": "fingerprint",
  };
  if (secret) {
    headers["X-Worker-Secret"] = secret;
  }

  const useCloudTasks =
    Boolean(process.env["CLOUD_TASKS_QUEUE"]) &&
    Boolean(process.env["GCP_PROJECT_ID"]) &&
    process.env["SKIP_CLOUD_TASKS"] !== "true";

  if (!useCloudTasks) {
    const res = await fetch(`${workerBaseUrl().replace(/\/$/, "")}/jobs`, {
      method: "POST",
      headers,
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Worker HTTP ${res.status}: ${text}`);
    }
    return;
  }

  const project = process.env["GCP_PROJECT_ID"]!;
  const location =
    process.env["GCP_TASKS_LOCATION"] ?? process.env["GCP_REGION"] ?? "us-central1";
  const queue = process.env["CLOUD_TASKS_QUEUE"]!;
  const client = new CloudTasksClient();
  const parent = client.queuePath(project, location, queue);
  const url = `${(process.env["WORKER_PUSH_URL"] ?? workerBaseUrl()).replace(/\/$/, "")}/jobs`;

  const httpRequest: {
    httpMethod: "POST";
    url: string;
    headers: Record<string, string>;
    body: string;
    oidcToken?: { serviceAccountEmail: string };
  } = {
    httpMethod: "POST",
    url,
    headers,
    body: Buffer.from(body, "utf-8").toString("base64"),
  };

  const sa = process.env["CLOUD_TASKS_SA_EMAIL"];
  if (sa) {
    httpRequest.oidcToken = { serviceAccountEmail: sa };
  }

  await client.createTask({ parent, task: { httpRequest } });
}
