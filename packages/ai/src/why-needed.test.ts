import { describe, it, expect, vi } from "vitest";
import type { AIProvider, LLMRequest } from "./provider";
import { generateWhyNeeded } from "./why-needed";

describe("generateWhyNeeded", () => {
  it("returns 2–3 plain-English sentences without compliance codes", async () => {
    const complete = vi.fn().mockResolvedValue({
      content:
        "This supports SOC2:CC6.1 and ISO27001:A.9.2.1. It helps ensure access is correct. Auditors will review this.",
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

    const out = await generateWhyNeeded(provider, {
      controlName: "AWS IAM access review",
      domain: "Access Control",
      connectedIntegrations: ["aws"],
    });

    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toMatch(/SOC2:|ISO27001:|CC\d|A\.\d/i);

    const req = complete.mock.calls[0]?.[0] as LLMRequest | undefined;
    expect(req?.model).toBe("claude-sonnet-4-6");
    expect(req?.maxTokens).toBeLessThanOrEqual(220);
  });
});

