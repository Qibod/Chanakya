import {
  fingerprintInferencePayloadSchema,
  type FingerprintInferencePayload,
} from "@grc/types";
import { assertNoInjection } from "./guards/injection-guard.js";

/** Strip optional markdown JSON fences from model output. */
export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence?.[1]) {
    return fence[1].trim();
  }
  return trimmed;
}

export function parseFingerprintJson(raw: string): FingerprintInferencePayload {
  const jsonText = extractJsonObject(raw);
  assertNoInjection(jsonText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    throw new Error("LLM_OUTPUT_INVALID");
  }
  const result = fingerprintInferencePayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("LLM_OUTPUT_INVALID");
  }
  return result.data;
}
