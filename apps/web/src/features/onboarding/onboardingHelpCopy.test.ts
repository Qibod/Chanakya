import { describe, expect, it } from "vitest";
import { containsOnboardingJargon, ONBOARDING_HELP_COPY } from "./onboardingHelpCopy";

describe("onboardingHelpCopy", () => {
  it("contains no framework clause / control-code jargon", () => {
    for (const entry of Object.values(ONBOARDING_HELP_COPY)) {
      const blob = `${entry.title} ${entry.body} ${entry.whyItMatters}`;
      expect(containsOnboardingJargon(blob)).toBe(false);
    }
  });
});
