import { describe, it, expect, vi } from "vitest";
import type { AIProvider, LLMRequest } from "./provider";

import { generateTaskInstructions } from "./task-instructions";

describe("generateTaskInstructions", () => {
  it("calls provider.complete with claude-sonnet-4-6 and returns instruction text", async () => {
    const complete = vi.fn().mockResolvedValue({
      content: "Step 1\nStep 2",
      model: "claude-sonnet-4-6",
      inputTokens: 1,
      outputTokens: 1,
    });
    const provider: AIProvider = {
      complete: complete as unknown as AIProvider["complete"],
      stream: (async function* () {
        yield "";
      })(),
    } as unknown as AIProvider;

    const instruction = await generateTaskInstructions(provider, {
      controlName: "Logical access",
      domain: "Access Control",
      frameworkRefs: ["SOC2:CC6.1"],
      connectedIntegrations: ["aws", "okta"],
    });

    expect(instruction).toContain("Step");
    const req = complete.mock.calls[0]?.[0] as LLMRequest | undefined;
    expect(req?.model).toBe("claude-sonnet-4-6");
    expect(req?.messages?.[0]?.content).toContain("Logical access");
  });
});

