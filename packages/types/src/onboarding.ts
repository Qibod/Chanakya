import { z } from "zod";

export const ONBOARDING_STEP_IDS = [
  "fingerprint",
  "framework",
  "integration",
  "assign_control",
  "first_report",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export const onboardingStepsRecordSchema = z.object({
  fingerprint: z.boolean(),
  framework: z.boolean(),
  integration: z.boolean(),
  assign_control: z.boolean(),
  first_report: z.boolean(),
});

export type OnboardingStepsRecord = z.infer<typeof onboardingStepsRecordSchema>;

export const onboardingProgressDataSchema = z.object({
  steps: onboardingStepsRecordSchema,
  completedCount: z.number().int().min(0).max(5),
  total: z.literal(5),
  allComplete: z.boolean(),
  dismissedAt: z.string().nullable(),
});

export type OnboardingProgressData = z.infer<typeof onboardingProgressDataSchema>;

/** Completable onboarding steps (derived steps use PATCH controls or DB inserts elsewhere). */
export const postOnboardingCompleteStepBodySchema = z.object({
  step: z.enum(["integration", "first_report"]),
});

export type PostOnboardingCompleteStepBody = z.infer<
  typeof postOnboardingCompleteStepBodySchema
>;

export const patchControlBodySchema = z.object({
  assignToSelf: z.literal(true),
});

export type PatchControlBody = z.infer<typeof patchControlBodySchema>;

/** Integration onboarding stub row — real connectors update this table with provider + connected status. */
export const ONBOARDING_MANUAL_INTEGRATION_PROVIDER = "manual_onboarding";
