import { describe, it, expect } from "vitest";
import {
  CANONICAL_CONTROLS,
  computeIncrementalCoverage,
  computeOverlapPercent,
  computeRecommendedFrameworks,
  controlCountForFramework,
  distinctFrameworkIdsFromRefs,
  formatNewFrameworksLabel,
  isControlSharedAcrossFrameworks,
  mergeCanonicalControlsForFrameworks,
  parseFrameworkRefsArray,
  sharedControlsCountForFramework,
  estimatedGapsForFramework,
} from "./framework-catalog.js";
import { fingerprintInferencePayloadSchema } from "./fingerprint.js";

describe("mergeCanonicalControlsForFrameworks", () => {
  it("dedupes shared canonical across SOC2 + ISO27001", () => {
    const rows = mergeCanonicalControlsForFrameworks(["SOC2", "ISO27001"]);
    const access = rows.find((r) => r.canonicalId === "c-access-logical");
    expect(access?.frameworkRefs.length).toBe(2);
    expect(access?.frameworkRefs.some((r) => r.startsWith("SOC2:"))).toBe(true);
    expect(access?.frameworkRefs.some((r) => r.startsWith("ISO27001:"))).toBe(true);
  });

  it("computes overlap when 2+ frameworks cover same canonical", () => {
    const sel = ["SOC2", "ISO27001"] as const;
    const rows = mergeCanonicalControlsForFrameworks([...sel]);
    const p = computeOverlapPercent([...sel], rows);
    expect(p).not.toBeNull();
    expect(p! >= 0 && p! <= 100).toBe(true);
  });
});

describe("computeOverlapPercent", () => {
  it("returns null for single framework", () => {
    const rows = mergeCanonicalControlsForFrameworks(["SOC2"]);
    expect(computeOverlapPercent(["SOC2"], rows)).toBeNull();
  });
});

describe("computeRecommendedFrameworks", () => {
  it("does not score SOX from baseball 'Red Sox' copy alone", () => {
    const base = fingerprintInferencePayloadSchema.parse({
      industryClassification: {
        title: "Sports blog",
        detail: "Red Sox season coverage",
        confidence: 0.5,
        confidenceTier: "medium",
        sources: ["Web"],
      },
      regulatoryObligations: [
        {
          title: "Editorial policy",
          detail: "No financial advice",
          confidence: 0.5,
          confidenceTier: "medium",
          sources: ["Internal"],
        },
      ],
      inferredOrgStructure: {
        title: "Tiny team",
        detail: "Remote",
        confidence: 0.5,
        confidenceTier: "medium",
        sources: ["LinkedIn"],
      },
      businessProcesses: [
        {
          title: "Publish",
          detail: "Daily posts",
          confidence: 0.5,
          confidenceTier: "medium",
          sources: ["CMS"],
        },
      ],
      riskDomains: [
        {
          title: "Brand",
          detail: "Reputation",
          confidence: 0.5,
          confidenceTier: "medium",
          sources: ["PR"],
        },
      ],
    });
    const rec = computeRecommendedFrameworks(base);
    expect(rec.includes("SOX")).toBe(false);
  });

  it("returns SOC2 for generic B2B SaaS text", () => {
    const base = fingerprintInferencePayloadSchema.parse({
      industryClassification: {
        title: "B2B SaaS",
        detail: "Cloud software vendor",
        confidence: 0.9,
        confidenceTier: "high",
        sources: ["Web"],
      },
      regulatoryObligations: [
        {
          title: "SOC 2 Type II for enterprise sales",
          detail: "Customers request SOC reports",
          confidence: 0.85,
          confidenceTier: "high",
          sources: ["Sales"],
        },
      ],
      inferredOrgStructure: {
        title: "Flat engineering org",
        detail: "~80 employees",
        confidence: 0.6,
        confidenceTier: "medium",
        sources: ["LinkedIn"],
      },
      businessProcesses: [
        {
          title: "Deploy weekly",
          detail: "CI/CD",
          confidence: 0.8,
          confidenceTier: "high",
          sources: ["Site"],
        },
      ],
      riskDomains: [
        {
          title: "Access risk",
          detail: "IDaaS",
          confidence: 0.7,
          confidenceTier: "medium",
          sources: ["Interviews"],
        },
      ],
    });
    const rec = computeRecommendedFrameworks(base);
    expect(rec).toContain("SOC2");
  });
});

describe("Story 2.6 mapping helpers", () => {
  it("parses framework refs", () => {
    const p = parseFrameworkRefsArray(["SOC2:CC6.1", "ISO27001:A.9.2.1"]);
    expect(p).toHaveLength(2);
    expect(p[0]?.frameworkId).toBe("SOC2");
    expect(p[1]?.code).toBe("A.9.2.1");
  });

  it("detects shared controls across frameworks", () => {
    expect(isControlSharedAcrossFrameworks(["SOC2:CC6.1"])).toBe(false);
    expect(isControlSharedAcrossFrameworks(["SOC2:CC6.1", "ISO27001:A.9.2.1"])).toBe(true);
  });

  it("counts distinct frameworks", () => {
    expect(distinctFrameworkIdsFromRefs(["SOC2:A", "SOC2:B"]).length).toBe(1);
    expect(distinctFrameworkIdsFromRefs(["SOC2:A", "GDPR:B"]).length).toBe(2);
  });

  it("sharedControlsCountForFramework scopes overlap", () => {
    const rows = [
      ["SOC2:CC6.1", "ISO27001:A.9.2.1"],
      ["SOC2:CC8.1"],
      ["SOC2:CC9.2", "ISO27001:A.15.1.1"],
    ];
    expect(sharedControlsCountForFramework("SOC2", rows)).toBe(2);
    expect(sharedControlsCountForFramework("ISO27001", rows)).toBe(2);
  });

  it("computeIncrementalCoverage counts unique canonical overlaps", () => {
    const existing = new Set(["c-access-logical", "c-change-mgmt", "c-risk-program", "c-vendor", "c-soc-env"]);
    const cov = computeIncrementalCoverage(existing, ["ISO27001"]);
    expect(cov.alreadyCoveredCount).toBe(3);
    expect(cov.perFramework["ISO27001"]).toBe(3);
  });

  it("formats activation labels", () => {
    expect(formatNewFrameworksLabel(["ISO27001"])).toContain("ISO");
    expect(formatNewFrameworksLabel(["SOC2", "GDPR"])).toContain("and");
  });
});

describe("catalog counts", () => {
  it("each framework has at least one control", () => {
    const ids = ["SOC2", "ISO27001", "SOX", "GDPR", "NIST_CSF"] as const;
    for (const id of ids) {
      expect(controlCountForFramework(id)).toBeGreaterThan(0);
      expect(estimatedGapsForFramework(id)).toBeGreaterThanOrEqual(1);
    }
    expect(CANONICAL_CONTROLS.length).toBeGreaterThanOrEqual(5);
  });
});
