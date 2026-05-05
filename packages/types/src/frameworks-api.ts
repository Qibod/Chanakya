import { z } from "zod";
import { FRAMEWORK_IDS } from "./framework-catalog";
import type { SubscriptionTier } from "./rbac";
import { TIER_ORDER } from "./rbac";

export const frameworkIdSchema = z.enum([
  "SOC2",
  "ISO27001",
  "SOX",
  "GDPR",
  "NIST_CSF",
]);

export const postFrameworkActivateBodySchema = z.object({
  frameworkIds: z
    .array(frameworkIdSchema)
    .min(1)
    .max(5)
    .superRefine((ids, ctx) => {
      const set = new Set(ids);
      if (set.size !== ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate framework ids",
        });
      }
    }),
});

export type PostFrameworkActivateBody = z.infer<typeof postFrameworkActivateBodySchema>;

/** Max frameworks activatable in one request per PRD tier matrix. */
export function maxFrameworkSelectionsForTier(tier: SubscriptionTier): number {
  if (tier === "starter") return 1;
  if (tier === "growth") return 3;
  /** Scale = unlimited per PRD; cap at catalog size (no duplicate framework slots). */
  return FRAMEWORK_IDS.length;
}

/**
 * Returns error message if selection violates tier cap, else null.
 * Starter: 1. Growth: 3. Scale: unlimited (cap at catalog size in route).
 */
export function validateFrameworkSelectionCount(
  tier: SubscriptionTier,
  count: number
): string | null {
  const max = maxFrameworkSelectionsForTier(tier);
  if (count > max) {
    return `Your plan allows at most ${max} active framework(s) at a time.`;
  }
  return null;
}

/** 402 if route requires higher tier than tenant (not used for framework routes — include for future). */
export function tierMeets(minimum: SubscriptionTier, actual: SubscriptionTier): boolean {
  return TIER_ORDER[actual] >= TIER_ORDER[minimum];
}

export const frameworkLibraryItemSchema = z.object({
  id: frameworkIdSchema,
  title: z.string(),
  shortDescription: z.string(),
  controlCount: z.number().int().nonnegative(),
  estimatedGaps: z.number().int().nonnegative(),
  recommended: z.boolean(),
  alreadyActivated: z.boolean(),
});

export const getFrameworkLibraryResponseSchema = z.object({
  tier: z.enum(["starter", "growth", "scale"]),
  maxSelectable: z.number().int().positive(),
  recommended: z.array(frameworkIdSchema),
  frameworks: z.array(frameworkLibraryItemSchema),
});

export type GetFrameworkLibraryResponse = z.infer<typeof getFrameworkLibraryResponseSchema>;

export const postFrameworkActivateResponseSchema = z.object({
  activated: z.array(frameworkIdSchema),
  controlsCreated: z.number().int().nonnegative(),
  overlapPercent: z.number().int().min(0).max(100).nullable(),
  /** Canonical controls already present that new framework(s) also map to (Story 2.6). */
  alreadyCoveredCount: z.number().int().nonnegative(),
  /** Short label for UI toast (one or more frameworks). */
  frameworkLabel: z.string(),
  /** Optional per-framework overlap counts for diagnostics/tests. */
  coverageBreakdown: z.record(frameworkIdSchema, z.number().int().nonnegative()).optional(),
});

export type PostFrameworkActivateResponse = z.infer<typeof postFrameworkActivateResponseSchema>;

export const controlRequirementDetailSchema = z.object({
  frameworkId: frameworkIdSchema,
  frameworkTitle: z.string(),
  code: z.string(),
});

export const getControlByIdResponseSchema = z.object({
  id: z.string(),
  canonicalId: z.string(),
  name: z.string(),
  domain: z.string(),
  status: z.string(),
  framework: z.string(),
  frameworkRefs: z.array(z.string()),
  requirementDetails: z.array(controlRequirementDetailSchema),
});

export type GetControlByIdResponse = z.infer<typeof getControlByIdResponseSchema>;

export const listControlsResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      id: z.string(),
      canonicalId: z.string(),
      name: z.string(),
      domain: z.string(),
      status: z.string(),
      assignedTo: z.string().nullable(),
      updatedAt: z.string().nullable(),
      framework: z.string(),
      frameworkRefs: z.array(z.string()),
    })
  ),
  /** Next page cursor (`id`); null when no further rows. */
  nextCursor: z.string().nullable(),
});

export type ListControlsResponse = z.infer<typeof listControlsResponseSchema>;

// ---------------------------------------------------------------------------
// Story 3.3: Control assignment (Audit Director)
// ---------------------------------------------------------------------------

export const postControlAssignBodySchema = z.object({
  assignedTo: z.string().min(1),
  /** ISO date: YYYY-MM-DD (stored as DATE). */
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid dueDate (expected YYYY-MM-DD)")
    .nullable()
    .optional(),
});

export type PostControlAssignBody = z.infer<typeof postControlAssignBodySchema>;
