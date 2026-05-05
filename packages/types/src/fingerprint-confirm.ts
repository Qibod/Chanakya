import { z } from "zod";
import type { FingerprintInferencePayload, FingerprintSlice } from "./fingerprint.js";
import { fingerprintInferencePayloadSchema } from "./fingerprint.js";

/** Max overrides entries / removed ids accepted per confirm request (DoS guard). */
export const FINGERPRINT_CONFIRM_MAX_KEYS = 128;

/** Max characters per override string. */
export const FINGERPRINT_CONFIRM_MAX_STRING = 8192;

export const postFingerprintConfirmBodySchema = z.object({
  overrides: z
    .record(z.string(), z.string())
    .optional()
    .superRefine((rec, ctx) => {
      if (!rec) return;
      const keys = Object.keys(rec);
      if (keys.length > FINGERPRINT_CONFIRM_MAX_KEYS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Too many override keys (max ${FINGERPRINT_CONFIRM_MAX_KEYS})`,
        });
      }
      for (const [k, v] of Object.entries(rec)) {
        if (k.length > 128) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Override key too long: ${k.slice(0, 32)}…`,
          });
        }
        if (v.length > FINGERPRINT_CONFIRM_MAX_STRING) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Override value too long for key ${k}`,
          });
        }
      }
    }),
  removedLineIds: z
    .array(z.string())
    .optional()
    .superRefine((arr, ctx) => {
      if (!arr) return;
      if (arr.length > FINGERPRINT_CONFIRM_MAX_KEYS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Too many removedLineIds (max ${FINGERPRINT_CONFIRM_MAX_KEYS})`,
        });
      }
      for (const id of arr) {
        if (id.length > 128) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `removedLineId too long`,
          });
        }
      }
    }),
});

export type PostFingerprintConfirmBody = z.infer<typeof postFingerprintConfirmBodySchema>;

/** Identifier shape from `buildFingerprintLines` — line ids only. */
export function cloneFingerprintPayload(base: FingerprintInferencePayload): FingerprintInferencePayload {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(base);
  }
  return JSON.parse(JSON.stringify(base)) as FingerprintInferencePayload;
}

/**
 * Whether the user may remove this stream line without violating schema minimums (≥1 obligation,
 * process, and risk slice). Uses original stream line ids + current removals (same contract as confirm).
 */
export function canRemoveFingerprintStreamLine(
  lineId: string,
  allStreamLineIds: readonly string[],
  removedLineIds: readonly string[]
): boolean {
  if (lineId === "integrations-synthetic" || lineId === "industry") return true;
  const prefix = lineId.startsWith("obligation-")
    ? "obligation-"
    : lineId.startsWith("process-")
      ? "process-"
      : lineId.startsWith("risk-")
        ? "risk-"
        : null;
  if (!prefix) return true;
  const remaining = allStreamLineIds.filter(
    (id) => id.startsWith(prefix) && !removedLineIds.includes(id)
  );
  return remaining.length > 1;
}

/** Parses `title: detail` text used in fingerprint stream overrides (first `: ` wins). */
export function parseFingerprintLineOverride(text: string): { title: string; detail: string } {
  const t = text.trim();
  const idx = t.indexOf(": ");
  if (idx === -1) {
    const title = t.length > 0 ? t : "Unspecified";
    return { title, detail: "" };
  }
  const title = t.slice(0, idx).trim() || "Unspecified";
  const detail = t.slice(idx + 2).trim();
  return { title, detail };
}

const REMOVED_INDUSTRY_PLACEHOLDER: FingerprintSlice = {
  title: "Not specified",
  detail: "Industry line was removed during review.",
  confidence: 0,
  confidenceTier: "low",
  sources: ["User"],
};

function applySliceOverride(slice: FingerprintSlice, text: string): FingerprintSlice {
  const { title, detail } = parseFingerprintLineOverride(text);
  return { ...slice, title, detail };
}

/**
 * Applies inline edits from the fingerprint stream UI onto the inference payload.
 * - `overrides` keys are stream line ids (`industry`, `obligation-0`, …, `integrations-synthetic`).
 * - `removedLineIds` removes slices; indices refer to the **original** payload arrays (before removals).
 * - `inferredOrgStructure` is never edited here (no stream lines in Story 2.2) — always preserved from `base`.
 * - `integrations-synthetic` is UI-only; overrides/removals for it do not affect stored JSON.
 */
export function applyFingerprintConfirmEdits(
  base: FingerprintInferencePayload,
  overrides: Record<string, string> | undefined,
  removedLineIds: string[] | undefined
): FingerprintInferencePayload {
  const out = cloneFingerprintPayload(base);
  const ovr = overrides ?? {};
  const removed = new Set(removedLineIds ?? []);

  for (const [id, text] of Object.entries(ovr)) {
    if (id === "integrations-synthetic") continue;
    if (id === "industry") {
      out.industryClassification = applySliceOverride(out.industryClassification, text);
      continue;
    }
    if (id.startsWith("obligation-")) {
      const i = Number.parseInt(id.slice("obligation-".length), 10);
      if (!Number.isFinite(i) || i < 0 || i >= out.regulatoryObligations.length) continue;
      out.regulatoryObligations[i] = applySliceOverride(out.regulatoryObligations[i]!, text);
      continue;
    }
    if (id.startsWith("process-")) {
      const i = Number.parseInt(id.slice("process-".length), 10);
      if (!Number.isFinite(i) || i < 0 || i >= out.businessProcesses.length) continue;
      out.businessProcesses[i] = applySliceOverride(out.businessProcesses[i]!, text);
      continue;
    }
    if (id.startsWith("risk-")) {
      const i = Number.parseInt(id.slice("risk-".length), 10);
      if (!Number.isFinite(i) || i < 0 || i >= out.riskDomains.length) continue;
      out.riskDomains[i] = applySliceOverride(out.riskDomains[i]!, text);
      continue;
    }
  }

  const obligationIdxs = [...removed]
    .filter((id) => id.startsWith("obligation-"))
    .map((id) => Number.parseInt(id.slice("obligation-".length), 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  for (const i of obligationIdxs) {
    if (i >= 0 && i < out.regulatoryObligations.length) {
      out.regulatoryObligations.splice(i, 1);
    }
  }

  const processIdxs = [...removed]
    .filter((id) => id.startsWith("process-"))
    .map((id) => Number.parseInt(id.slice("process-".length), 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  for (const i of processIdxs) {
    if (i >= 0 && i < out.businessProcesses.length) {
      out.businessProcesses.splice(i, 1);
    }
  }

  const riskIdxs = [...removed]
    .filter((id) => id.startsWith("risk-"))
    .map((id) => Number.parseInt(id.slice("risk-".length), 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  for (const i of riskIdxs) {
    if (i >= 0 && i < out.riskDomains.length) {
      out.riskDomains.splice(i, 1);
    }
  }

  if (removed.has("industry")) {
    out.industryClassification = { ...REMOVED_INDUSTRY_PLACEHOLDER };
  }

  return out;
}

/** Validates merged payload (throws ZodError if invalid). */
export function assertValidFingerprintPayload(data: FingerprintInferencePayload): FingerprintInferencePayload {
  return fingerprintInferencePayloadSchema.parse(data);
}
