export type WhyNeededInput = {
  controlName: string;
  domain: string;
  connectedIntegrations: string[];
};

export function buildWhyNeededPrompt(input: WhyNeededInput): string {
  const integrationsLine =
    input.connectedIntegrations.length > 0
      ? input.connectedIntegrations.join(", ")
      : "none (manual)";

  return [
    "You are generating a plain-English explanation for a control owner.",
    "They clicked: “Why is this needed?”",
    "",
    "Constraints:",
    "- 2–3 sentences only.",
    "- Plain English. No audit/compliance jargon.",
    "- Do NOT include any compliance codes (e.g., CC6.1, ISO A.9.2) anywhere.",
    "- Do NOT mention internal systems, databases, schema names, or model IDs.",
    "- Use only the metadata provided. Do not ask for additional data.",
    "",
    `Control name: ${input.controlName}`,
    `Domain: ${input.domain}`,
    `Connected integrations: ${integrationsLine}`,
    "",
    "Return only the explanation text.",
  ].join("\n");
}

