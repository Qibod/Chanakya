/** Plain-language onboarding help — no regulatory clause codes (Story 2.5). */

export type OnboardingHelpKey =
  | "fingerprint"
  | "frameworks"
  | "integrations"
  | "dashboard_assign"
  | "dashboard_report";

export type OnboardingHelpContent = {
  title: string;
  body: string;
  whyItMatters: string;
};

export const ONBOARDING_HELP_COPY: Record<OnboardingHelpKey, OnboardingHelpContent> = {
  fingerprint: {
    title: "Company fingerprint",
    body: "We gather public information about your organisation so we can suggest the right compliance scope — without asking you to fill out long questionnaires.",
    whyItMatters: "You see value in the first minute instead of starting from a blank page.",
  },
  frameworks: {
    title: "Framework activation",
    body: "Choose which compliance programmes apply to your business. We load the matching controls into one shared library.",
    whyItMatters: "Your team works from a single control set instead of juggling separate spreadsheets per programme.",
  },
  integrations: {
    title: "Connect your tools",
    body: "Link systems you already use so evidence can flow in automatically when connectors are available.",
    whyItMatters: "Less manual proof collection means faster audits and fewer surprises.",
  },
  dashboard_assign: {
    title: "Assign a control",
    body: "Pick one control and assign it to yourself so ownership is clear and tasks show up in your queue.",
    whyItMatters: "Ownership makes follow-through measurable — nothing falls through the cracks.",
  },
  dashboard_report: {
    title: "Generate a summary",
    body: "Create a lightweight compliance summary you can share internally. This is a starting summary — not a substitute for your auditor’s opinion.",
    whyItMatters: "You get a tangible artefact that proves the platform is working for your organisation.",
  },
};

/** Guardrail for tests: onboarding help must not echo framework clause / control-code jargon. */
export const JARGON_BANNED_PATTERNS: RegExp[] = [
  // SOC2 / generic control codes like CC6.1, CC8.1
  /\bCC\d+(?:\.\d+)*\b/i,
  // ISO Annex references like Annex A, Annex B
  /\bAnnex\s+[A-Z]\b/i,
  // ISO clause-like tokens like A.9.2, A.12.1.3
  /\bA\.\d+(?:\.\d+)*\b/i,
  // GDPR-ish article references like Art. 32 / Article 32
  /\bArt\.?\s*\d+\b/i,
  /\bArticle\s+\d+\b/i,
  // Common ITGC shorthand
  /\bITGC\b/i,
  // NIST CSF style like GV.OC-1, PR.AC-3
  /\b(?:GV|ID|PR|DE|RS|RC)\.[A-Z]{2}-\d+\b/i,
];

export function containsOnboardingJargon(text: string): boolean {
  return JARGON_BANNED_PATTERNS.some((re) => re.test(text));
}
