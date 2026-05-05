import type { FingerprintInferencePayload, FingerprintSlice } from "@grc/types";

export type StreamPhase = 1 | 2 | 3 | 4;

export type StreamLine = {
  id: string;
  phase: StreamPhase;
  /** Arc segment label */
  phaseLabel: string;
  /** Chip shown on the line */
  phaseChip: string;
  title: string;
  detail: string;
  slice: FingerprintSlice;
};

const INTEGRATIONS_PHASE_COPY = {
  title: "Integrations",
  detail:
    "Connect your security and cloud tooling on the next steps to automate evidence collection — recommended integrations appear after fingerprint review.",
  confidence: 1,
  confidenceTier: "high" as const,
  sources: ["Onboarding"],
};

/**
 * Flattens inference payload into ordered stream lines with UX phase metadata.
 * Phase 4 is synthetic — no LLM field yet (Story 2.2).
 */
export function buildFingerprintLines(payload: FingerprintInferencePayload): StreamLine[] {
  const lines: StreamLine[] = [];

  lines.push({
    id: "industry",
    phase: 1,
    phaseLabel: "Industry",
    phaseChip: "Industry",
    title: payload.industryClassification.title,
    detail: payload.industryClassification.detail,
    slice: payload.industryClassification,
  });

  payload.regulatoryObligations.forEach((slice, i) => {
    lines.push({
      id: `obligation-${i}`,
      phase: 2,
      phaseLabel: "Obligations",
      phaseChip: "Obligation",
      title: slice.title,
      detail: slice.detail,
      slice,
    });
  });

  payload.businessProcesses.forEach((slice, i) => {
    lines.push({
      id: `process-${i}`,
      phase: 3,
      phaseLabel: "Controls",
      phaseChip: "Control",
      title: slice.title,
      detail: slice.detail,
      slice,
    });
  });

  payload.riskDomains.forEach((slice, i) => {
    lines.push({
      id: `risk-${i}`,
      phase: 3,
      phaseLabel: "Controls",
      phaseChip: "Risk",
      title: slice.title,
      detail: slice.detail,
      slice,
    });
  });

  lines.push({
    id: "integrations-synthetic",
    phase: 4,
    phaseLabel: "Integrations",
    phaseChip: "Integrations",
    title: INTEGRATIONS_PHASE_COPY.title,
    detail: INTEGRATIONS_PHASE_COPY.detail,
    slice: {
      title: INTEGRATIONS_PHASE_COPY.title,
      detail: INTEGRATIONS_PHASE_COPY.detail,
      confidence: INTEGRATIONS_PHASE_COPY.confidence,
      confidenceTier: INTEGRATIONS_PHASE_COPY.confidenceTier,
      sources: [...INTEGRATIONS_PHASE_COPY.sources],
    },
  });

  return lines;
}
