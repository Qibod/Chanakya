/**
 * Fingerprinting prompts — public-metadata narrative only (no attachments, no evidence bytes).
 * Output must be a single JSON object matching {@link @grc/types#fingerprintInferencePayloadSchema}.
 */

export function buildFingerprintSystemPrompt(): string {
  return `You are a compliance research assistant. Infer likely industry, regulatory obligations, organizational shape, business processes, and risk domains for the given company using ONLY the company name and generally-known public knowledge patterns.
Rules:
- Respond with a single JSON object only. No markdown fences, no prose outside JSON.
- Every slice must include: title, detail, confidence (0..1), confidenceTier ("high" | "medium" | "low"), sources (non-empty array of short strings naming plausible source categories such as "LinkedIn", "SEC filings", "APQC", "Industry norms").
- confidenceTier must align with confidence: high >= 0.8, medium 0.5..0.79, low < 0.5.
- Use conservative estimates when uncertain; prefer medium/low tiers over overstating confidence.
- Never claim you accessed private systems or internal documents.`;
}

export function buildFingerprintUserPrompt(companyName: string): string {
  return `Company name: ${companyName}

Return JSON with keys exactly:
{
  "industryClassification": { "title", "detail", "confidence", "confidenceTier", "sources" },
  "regulatoryObligations": [ same slice shape ... ],
  "inferredOrgStructure": { ... },
  "businessProcesses": [ ... ],
  "riskDomains": [ ... ]
}`;
}
