import type { AIProvider } from "./provider";
import { buildWhyNeededPrompt, type WhyNeededInput } from "./prompts/why-needed";

function fallbackWhyNeeded(controlName: string): string {
  return `This task helps confirm ${controlName} is working as expected and reduces the chance of surprises later. It also creates a clear record of what you checked and when, so the team can stay confident and consistent.`;
}

export function stripCodesAndJargon(text: string): string {
  return (
    text
      // Remove common compliance-code patterns
      .replace(/\bSOC2:\s*[A-Z0-9.\-]+\b/gi, "")
      .replace(/\bISO27001:\s*[A-Z0-9.\-]+\b/gi, "")
      .replace(/\bCC\d+(\.\d+)?\b/gi, "")
      .replace(/\bA\.\d+(\.\d+)*\b/gi, "")
      // Soft-remove some audit-y words that often creep in
      .replace(/\battestation\b/gi, "confirmation")
      .replace(/\boperating effectiveness\b/gi, "day-to-day effectiveness")
      .replace(/\bcontrol objective\b/gi, "goal")
      .replace(/\bworkpaper(s)?\b/gi, "record")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

function clampToTwoOrThreeSentences(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) return cleaned;
  if (parts.length <= 3) return parts.join(" ");
  return parts.slice(0, 3).join(" ");
}

export async function generateWhyNeeded(provider: AIProvider, input: WhyNeededInput): Promise<string> {
  try {
    const resp = await provider.complete({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: buildWhyNeededPrompt(input) }],
      maxTokens: 220,
    });
    const raw = resp.content.trim();
    const stripped = stripCodesAndJargon(raw);
    const clamped = clampToTwoOrThreeSentences(stripped);
    return clamped.length > 0 ? clamped : fallbackWhyNeeded(input.controlName);
  } catch {
    return fallbackWhyNeeded(input.controlName);
  }
}

