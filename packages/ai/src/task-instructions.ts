import type { AIProvider } from "./provider";
import { buildTaskInstructionsPrompt } from "./prompts/task-instructions";

export type TaskInstructionsInput = {
  controlName: string;
  domain: string;
  frameworkRefs: string[];
  connectedIntegrations: string[];
};

function fallbackInstruction(controlName: string): string {
  return [
    `Complete the assigned control: ${controlName}.`,
    "",
    "What you'll need:",
    "- Access to the relevant system(s)",
    "- Any existing policy or checklist your team uses",
    "",
    "Steps:",
    "1. Review what the control is asking for in plain terms (who/what/when).",
    "2. In the relevant system(s), confirm the current state matches what’s expected.",
    "3. Capture evidence (screenshot/export/log) for the current period.",
    "4. If something is missing, fix it or flag it to the Audit Director with what’s needed.",
    "5. Upload/attach the evidence to the control task.",
    "6. Mark the task complete.",
  ].join("\n");
}

export async function generateTaskInstructions(
  provider: AIProvider,
  input: TaskInstructionsInput
): Promise<string> {
  try {
    const resp = await provider.complete({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: buildTaskInstructionsPrompt(input) }],
      maxTokens: 700,
    });
    const trimmed = resp.content.trim();
    return trimmed.length > 0 ? trimmed : fallbackInstruction(input.controlName);
  } catch {
    return fallbackInstruction(input.controlName);
  }
}

