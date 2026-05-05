import { describe, it, expect } from "vitest";
import { parseFingerprintJson } from "./fingerprint-parse.js";

const validJson = `{
  "industryClassification": {
    "title": "Software",
    "detail": "SaaS",
    "confidence": 0.85,
    "confidenceTier": "high",
    "sources": ["Industry norms"]
  },
  "regulatoryObligations": [
    {
      "title": "SOC 2",
      "detail": "Customer trust",
      "confidence": 0.8,
      "confidenceTier": "high",
      "sources": ["Industry norms"]
    }
  ],
  "inferredOrgStructure": {
    "title": "Flat engineering org",
    "detail": "Typical startup",
    "confidence": 0.55,
    "confidenceTier": "medium",
    "sources": ["LinkedIn"]
  },
  "businessProcesses": [
    {
      "title": "Change management",
      "detail": "PR reviews",
      "confidence": 0.6,
      "confidenceTier": "medium",
      "sources": ["APQC"]
    }
  ],
  "riskDomains": [
    {
      "title": "Data protection",
      "detail": "PII",
      "confidence": 0.7,
      "confidenceTier": "medium",
      "sources": ["Industry norms"]
    }
  ]
}`;

describe("parseFingerprintJson", () => {
  it("parses fenced JSON", () => {
    const fenced = "```json\n" + validJson + "\n```";
    const out = parseFingerprintJson(fenced);
    expect(out.industryClassification.title).toBe("Software");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseFingerprintJson("not-json")).toThrow();
  });
});
