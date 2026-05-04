/**
 * Worker HTTP router — Cloud Tasks POSTs to this service.
 * Each job type is dispatched to its handler based on the X-Job-Type header
 * or the request path.
 *
 * Job naming convention: {tenantId}.{jobType}.{uuidv7}
 * Job types: fingerprint | report-generate | evidence-sync | regulatory-scan | integration-poll
 */
import http from "node:http";

const PORT = Number(process.env["PORT"] ?? 3002);

const server = http.createServer((req, res) => {
  // Health check for Cloud Run readiness probe
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Cloud Tasks job dispatch — implemented in subsequent stories
  if (req.method === "POST" && req.url === "/jobs") {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      console.log("Job received (stub):", body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "accepted" }));
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
