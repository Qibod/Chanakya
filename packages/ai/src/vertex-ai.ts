import AnthropicVertex from "@anthropic-ai/vertex-sdk";
import type { AIProvider, LLMRequest, LLMResponse, ModelId } from "./provider.js";

function resolveProjectId(): string {
  return (
    process.env["VERTEX_AI_PROJECT"] ??
    process.env["ANTHROPIC_VERTEX_PROJECT_ID"] ??
    process.env["GCP_PROJECT_ID"] ??
    ""
  );
}

function resolveRegion(): string {
  return process.env["VERTEX_AI_LOCATION"] ?? process.env["CLOUD_ML_REGION"] ?? "us-central1";
}

/** Vertex publication ID for async fingerprint quality path (override via env). */
export function resolveFingerprintModelId(): string {
  return (
    process.env["GRC_VERTEX_MODEL_FINGERPRINT"] ??
    "claude-opus-4-20250514@20250514"
  );
}

function mapModelToVertexResource(model: ModelId): string {
  if (model === "claude-opus-4-7") {
    return resolveFingerprintModelId();
  }
  return process.env["GRC_VERTEX_MODEL_SYNC"] ?? "claude-sonnet-4-20250514@20250514";
}

export class VertexAIProvider implements AIProvider {
  private readonly client: AnthropicVertex;

  constructor() {
    const projectId = resolveProjectId();
    if (!projectId) {
      throw new Error(
        "Vertex AI project not configured — set VERTEX_AI_PROJECT or GCP_PROJECT_ID"
      );
    }
    this.client = new AnthropicVertex({
      region: resolveRegion(),
      projectId,
    });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const model = mapModelToVertexResource(request.model);
    const system = request.systemPrompt;

    const msg = await this.client.messages.create({
      model,
      max_tokens: request.maxTokens ?? 8192,
      system: system,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textBlocks = msg.content.filter((b) => b.type === "text");
    const content = textBlocks.map((b) => (b.type === "text" ? b.text : "")).join("");

    const usage = msg.usage;
    return {
      content,
      model: request.model,
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
    };
  }

  async *stream(request: LLMRequest): AsyncGenerator<string> {
    const response = await this.complete(request);
    yield response.content;
  }
}
