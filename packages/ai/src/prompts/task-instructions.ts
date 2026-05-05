// Task instruction generation prompt — implemented in Story 3.3
// Model: claude-sonnet-4-6 (synchronous, <5s)

import type { TaskInstructionsInput } from "../task-instructions";

export function buildTaskInstructionsPrompt(input: TaskInstructionsInput): string {
  const integrationsLine =
    input.connectedIntegrations.length > 0
      ? input.connectedIntegrations.join(", ")
      : "none (manual)";

  return [
    "You are generating plain-English task instructions for a control owner.",
    "",
    "Constraints:",
    "- Plain English, step-by-step (6–12 steps).",
    "- Optimize for completion in < 15 minutes.",
    "- The headline must NOT be a compliance code.",
    "- Do not mention internal systems, databases, schema-per-tenant, or LLM model IDs.",
    "- Use only the metadata provided; do not ask for raw evidence files or data dumps.",
    "- Add a short 'What you'll need' section if appropriate.",
    "- Optionally include compliance codes only under a final 'References' section.",
    "",
    `Control: ${input.controlName}`,
    `Domain: ${input.domain}`,
    `Framework references: ${input.frameworkRefs.join(", ") || "none"}`,
    `Connected integrations: ${integrationsLine}`,
    "",
    "Return only the instruction text.",
  ].join("\n");
}
