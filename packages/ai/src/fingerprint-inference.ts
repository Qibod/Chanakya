import type { FingerprintInferencePayload } from "@grc/types";
import { assertNoInjection } from "./guards/injection-guard.js";
import { assertMetadataOnly } from "./guards/metadata-only.js";
import { parseFingerprintJson } from "./fingerprint-parse.js";
import { buildFingerprintSystemPrompt, buildFingerprintUserPrompt } from "./prompts/fingerprint.js";
import type { AIProvider, LLMRequest } from "./provider.js";
import { VertexAIProvider } from "./vertex-ai.js";

/**
 * End-to-end fingerprint inference: Vertex Claude → JSON parse + Zod validation.
 * Inject a mock {@link AIProvider} in tests to avoid live Vertex calls.
 */
export async function runFingerprintInference(
  companyName: string,
  provider?: AIProvider
): Promise<FingerprintInferencePayload> {
  assertNoInjection(companyName);
  assertMetadataOnly(companyName);
  const impl = provider ?? new VertexAIProvider();
  const request: LLMRequest = {
    model: "claude-opus-4-7",
    systemPrompt: buildFingerprintSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildFingerprintUserPrompt(companyName),
      },
    ],
    maxTokens: 8192,
  };
  const response = await impl.complete(request);
  return parseFingerprintJson(response.content);
}
