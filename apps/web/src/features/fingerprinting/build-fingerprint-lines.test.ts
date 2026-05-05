import { describe, expect, it } from "vitest";
import type { FingerprintInferencePayload } from "@grc/types";
import { buildFingerprintLines } from "./build-fingerprint-lines";

const slice = (
  title: string,
  detail: string,
  confidence = 0.9,
  tier: "high" | "medium" | "low" = "high",
  sources: string[] = ["SEC filings"]
) => ({
  title,
  detail,
  confidence,
  confidenceTier: tier,
  sources,
});

const minimalPayload = (): FingerprintInferencePayload => ({
  industryClassification: slice("Software", "SaaS vendor"),
  regulatoryObligations: [slice("SOC 2", "Trust criteria")],
  inferredOrgStructure: slice("Flat", "Engineering-led"),
  businessProcesses: [slice("Deploy", "CI/CD")],
  riskDomains: [slice("Access", "IAM")],
});

describe("buildFingerprintLines", () => {
  it("orders industry → obligations → processes/risk → integrations", () => {
    const payload = minimalPayload();
    const lines = buildFingerprintLines(payload);

    expect(lines[0]?.phase).toBe(1);
    expect(lines[0]?.id).toBe("industry");

    expect(lines[1]?.phase).toBe(2);
    expect(lines[1]?.id).toBe("obligation-0");

    const idxProc = lines.findIndex((l) => l.id === "process-0");
    const idxRisk = lines.findIndex((l) => l.id === "risk-0");
    expect(idxProc).toBeGreaterThan(-1);
    expect(idxRisk).toBeGreaterThan(idxProc);

    const last = lines[lines.length - 1];
    expect(last?.phase).toBe(4);
    expect(last?.id).toBe("integrations-synthetic");
  });

  it("includes synthetic integrations slice with valid sources", () => {
    const lines = buildFingerprintLines(minimalPayload());
    const integ = lines.find((l) => l.id === "integrations-synthetic");
    expect(integ?.slice.sources.length).toBeGreaterThanOrEqual(1);
    expect(integ?.slice.confidenceTier).toBe("high");
  });
});
