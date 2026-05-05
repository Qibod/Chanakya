/* eslint-disable no-console -- minimal worker process logging (Story 2.1) */
import "./instrument.js";

/**
 * Worker HTTP router — Cloud Tasks POSTs to this service (or direct HTTP in dev).
 *
 * Job naming convention: {tenantId}.{jobType}.{uuidv7}
 * Job types: fingerprint | report-generate | evidence-sync | regulatory-scan | integration-poll
 */
import * as Sentry from "@sentry/node";
import { timingSafeEqual } from "node:crypto";
import http from "node:http";
import type { FingerprintTaskPayload } from "./jobs/fingerprint.job.js";
import { processFingerprintJob } from "./jobs/fingerprint.job.js";

const PORT = Number(process.env["PORT"] ?? 3002);

function verifyWorkerSecret(req: http.IncomingMessage): boolean {
  const secret = process.env["WORKER_INVOCATION_SECRET"];
  if (!secret) return true;
  const header = req.headers["x-worker-secret"];
  if (typeof header !== "string") return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method === "POST" && req.url === "/jobs") {
    if (!verifyWorkerSecret(req)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }

    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      void (async () => {
        try {
          const jobType = req.headers["x-job-type"];
          const payload = JSON.parse(body) as FingerprintTaskPayload;

          if (jobType === "fingerprint") {
            await processFingerprintJob(payload);
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unknown job type" }));
            return;
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          console.error("Job handler error:", err);
          Sentry.captureException(err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Job failed" }));
        }
      })();
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`Worker HTTP router listening on port ${PORT}`);
});

export { server };
