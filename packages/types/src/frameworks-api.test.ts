import { describe, it, expect } from "vitest";
import {
  postFrameworkActivateBodySchema,
  validateFrameworkSelectionCount,
  maxFrameworkSelectionsForTier,
} from "./frameworks-api";

describe("validateFrameworkSelectionCount", () => {
  it("starter allows 1", () => {
    expect(validateFrameworkSelectionCount("starter", 1)).toBeNull();
    expect(validateFrameworkSelectionCount("starter", 2)).toMatch(/at most 1/);
  });

  it("growth allows 3", () => {
    expect(maxFrameworkSelectionsForTier("growth")).toBe(3);
    expect(validateFrameworkSelectionCount("growth", 3)).toBeNull();
    expect(validateFrameworkSelectionCount("growth", 4)).toMatch(/at most 3/);
  });

  it("scale max equals catalog framework count", () => {
    expect(maxFrameworkSelectionsForTier("scale")).toBe(5);
    expect(validateFrameworkSelectionCount("scale", 5)).toBeNull();
    expect(validateFrameworkSelectionCount("scale", 6)).toMatch(/at most 5/);
  });
});

describe("postFrameworkActivateBodySchema", () => {
  it("rejects duplicates", () => {
    const r = postFrameworkActivateBodySchema.safeParse({
      frameworkIds: ["SOC2", "SOC2"],
    });
    expect(r.success).toBe(false);
  });

  it("accepts unique ids", () => {
    const r = postFrameworkActivateBodySchema.safeParse({
      frameworkIds: ["SOC2", "GDPR"],
    });
    expect(r.success).toBe(true);
  });
});
