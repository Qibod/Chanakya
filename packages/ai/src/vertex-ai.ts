// Anthropic Claude via GCP Vertex AI — implemented when packages/ai is first used (Story 2.1)
// Uses @anthropic-ai/sdk with Vertex AI transport
// Fallback: Anthropic direct API (same SDK, config flag ANTHROPIC_PROVIDER=direct)

import type { AIProvider, LLMRequest, LLMResponse } from "./provider";

export class VertexAIProvider implements AIProvider {
  async complete(_request: LLMRequest): Promise<LLMResponse> {
    throw new Error("VertexAIProvider not yet implemented — Story 2.1");
  }

  async *stream(_request: LLMRequest): AsyncGenerator<string> {
    throw new Error("VertexAIProvider stream not yet implemented — Story 2.1");
  }
}
