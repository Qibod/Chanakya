import { describe, it, expect } from "vitest";
import type { FingerprintInferencePayload } from "./fingerprint.js";
import {
  applyFingerprintConfirmEdits,
  assertValidFingerprintPayload,
  canRemoveFingerprintStreamLine,
  parseFingerprintLineOverride,
} from "./fingerprint-confirm.js";

function samplePayload(): FingerprintInferencePayload {
  return {
    industryClassification: {
      title: "Ind",
      detail: "Det",
      confidence: 0.9,
      confidenceTier: "high",
      sources: ["SEC"],
    },
    regulatoryObligations: [
      {
        title: "O1",
        detail: "d1",
        confidence: 0.8,
        confidenceTier: "high",
        sources: ["A"],
      },
      {
        title: "O2",
        detail: "d2",
        confidence: 0.7,
        confidenceTier: "medium",
        sources: ["B"],
      },
    ],
    inferredOrgStructure: {
      title: "Org",
      detail: "Org det",
      confidence: 0.85,
      confidenceTier: "high",
      sources: ["LinkedIn"],
    },
    businessProcesses: [
      {
        title: "P1",
        detail: "pd1",
        confidence: 0.8,
        confidenceTier: "high",
        sources: ["APQC"],
      },
    ],
    riskDomains: [
      {
        title: "R1",
        detail: "rd1",
        confidence: 0.75,
        confidenceTier: "medium",
        sources: ["NIST"],
      },
    ],
  };
}

describe("parseFingerprintLineOverride", () => {
  it("splits on first colon-space", () => {
    expect(parseFingerprintLineOverride("Title here: Detail there")).toEqual({
      title: "Title here",
      detail: "Detail there",
    });
  });

  it("uses whole string as title when no colon-space", () => {
    expect(parseFingerprintLineOverride("OnlyTitle")).toEqual({
      title: "OnlyTitle",
      detail: "",
    });
  });
});

describe("canRemoveFingerprintStreamLine", () => {
  const ids = [
    "industry",
    "obligation-0",
    "obligation-1",
    "process-0",
    "risk-0",
    "integrations-synthetic",
  ];

  it("blocks removing the last obligation line", () => {
    expect(canRemoveFingerprintStreamLine("obligation-0", ids, [])).toBe(true);
    expect(canRemoveFingerprintStreamLine("obligation-0", ids, ["obligation-1"])).toBe(false);
  });

  it("allows removing integrations synthetic anytime", () => {
    expect(canRemoveFingerprintStreamLine("integrations-synthetic", ids, [])).toBe(true);
  });
});

describe("applyFingerprintConfirmEdits", () => {
  it("passes through inferredOrgStructure unchanged", () => {
    const base = samplePayload();
    const out = applyFingerprintConfirmEdits(
      base,
      { industry: "NewInd: NewDet" },
      []
    );
    expect(out.inferredOrgStructure).toEqual(base.inferredOrgStructure);
    expect(out.industryClassification.title).toBe("NewInd");
    expect(out.industryClassification.detail).toBe("NewDet");
  });

  it("ignores integrations-synthetic overrides", () => {
    const base = samplePayload();
    const out = applyFingerprintConfirmEdits(
      base,
      { "integrations-synthetic": "X: Y" },
      []
    );
    expect(out).toEqual(base);
  });

  it("removes obligation rows by original index", () => {
    const base = samplePayload();
    const out = applyFingerprintConfirmEdits(base, {}, ["obligation-0"]);
    expect(out.regulatoryObligations).toHaveLength(1);
    expect(out.regulatoryObligations[0]?.title).toBe("O2");
  });

  it("applies overrides before removals use original indices", () => {
    const base = samplePayload();
    const out = applyFingerprintConfirmEdits(
      base,
      { "obligation-1": "Fixed: text" },
      ["obligation-0"]
    );
    expect(out.regulatoryObligations).toHaveLength(1);
    expect(out.regulatoryObligations[0]?.title).toBe("Fixed");
    expect(out.regulatoryObligations[0]?.detail).toBe("text");
  });

  it("replaces industry when removed", () => {
    const base = samplePayload();
    const out = applyFingerprintConfirmEdits(base, {}, ["industry"]);
    expect(out.industryClassification.sources).toEqual(["User"]);
    expect(out.industryClassification.confidenceTier).toBe("low");
  });

  it("produces schema-valid output for typical edits", () => {
    const base = samplePayload();
    const out = applyFingerprintConfirmEdits(
      base,
      { industry: "A: B", "risk-0": "R: D" },
      ["integrations-synthetic"]
    );
    expect(() => assertValidFingerprintPayload(out)).not.toThrow();
  });
});
