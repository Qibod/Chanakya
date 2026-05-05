import { describe, it, expect } from "vitest";
import {
  fingerprintInferencePayloadSchema,
  postFingerprintBodySchema,
} from "./fingerprint";

describe("fingerprint schemas", () => {
  it("accepts a valid inference payload", () => {
    const slice = {
      title: "B2B SaaS",
      detail: "Enterprise software",
      confidence: 0.82,
      confidenceTier: "high" as const,
      sources: ["Industry norms"],
    };
    const parsed = fingerprintInferencePayloadSchema.safeParse({
      industryClassification: slice,
      regulatoryObligations: [{ ...slice, title: "SOC 2" }],
      inferredOrgStructure: slice,
      businessProcesses: [{ ...slice, title: "SDLC" }],
      riskDomains: [{ ...slice, title: "Access control" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid post body", () => {
    expect(postFingerprintBodySchema.safeParse({ companyName: "" }).success).toBe(false);
  });
});
