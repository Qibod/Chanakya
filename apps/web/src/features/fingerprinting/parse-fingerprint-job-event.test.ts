import { describe, expect, it } from "vitest";
import { fingerprintJobEventSchema } from "@grc/types";

describe("fingerprintJobEventSchema (client envelope)", () => {
  it("accepts a completed wrapper around SSE data", () => {
    const data = {
      tenantId: "org_1",
      payload: {
        jobId: "org_1.fingerprint.abc",
        status: "pending_review" as const,
        summary: {
          industryClassification: {
            title: "Co",
            detail: "d",
            confidence: 0.9,
            confidenceTier: "high" as const,
            sources: ["X"],
          },
          regulatoryObligations: [
            {
              title: "O1",
              detail: "d",
              confidence: 0.8,
              confidenceTier: "high" as const,
              sources: ["Y"],
            },
          ],
          inferredOrgStructure: {
            title: "Org",
            detail: "d",
            confidence: 0.7,
            confidenceTier: "medium" as const,
            sources: ["Z"],
          },
          businessProcesses: [
            {
              title: "P1",
              detail: "d",
              confidence: 0.85,
              confidenceTier: "high" as const,
              sources: ["A"],
            },
          ],
          riskDomains: [
            {
              title: "R1",
              detail: "d",
              confidence: 0.6,
              confidenceTier: "medium" as const,
              sources: ["B"],
            },
          ],
        },
      },
      timestamp: new Date().toISOString(),
    };

    const wrapped = { event: "fingerprint.completed" as const, data };
    const ok = fingerprintJobEventSchema.safeParse(wrapped);
    expect(ok.success).toBe(true);
    if (ok.success && ok.data.event === "fingerprint.completed") {
      expect(ok.data.data.payload.summary?.industryClassification.title).toBe("Co");
    }
  });
});
