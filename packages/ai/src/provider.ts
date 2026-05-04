// AI provider interface — abstract over Anthropic direct API vs Vertex AI
// All LLM calls in the platform go through this interface (never direct SDK calls)
//
// ARCH-8:
//   claude-sonnet-4-6 → synchronous: co-pilot, inline AI, task instructions
//   claude-opus-4-7   → async jobs: report generation, fingerprinting, regulatory assessment
//   Provider: Anthropic Claude via GCP Vertex AI (fallback: Anthropic direct API via config flag)

export type ModelId =
  | "claude-sonnet-4-6"  // sync, <5s
  | "claude-opus-4-7";   // async jobs

export type LLMMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LLMRequest = {
  model: ModelId;
  messages: LLMMessage[];
  maxTokens?: number;
  systemPrompt?: string;
};

export type LLMResponse = {
  content: string;
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
};

export interface AIProvider {
  complete(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncGenerator<string>;
}
