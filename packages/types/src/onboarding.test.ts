import { describe, expect, it } from "vitest";
import {
  onboardingProgressDataSchema,
  postOnboardingCompleteStepBodySchema,
} from "./onboarding";

describe("onboarding schemas", () => {
  it("parses progress payload", () => {
    const parsed = onboardingProgressDataSchema.safeParse({
      steps: {
        fingerprint: true,
        framework: false,
        integration: false,
        assign_control: false,
        first_report: false,
      },
      completedCount: 1,
      total: 5,
      allComplete: false,
      dismissedAt: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("parses complete-step body", () => {
    const r = postOnboardingCompleteStepBodySchema.safeParse({ step: "integration" });
    expect(r.success).toBe(true);
  });
});
