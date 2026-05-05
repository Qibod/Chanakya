import type { FingerprintInferencePayload } from "./fingerprint";

/** Aligns with `@grc/ui` FrameworkBadge variants. */
export const FRAMEWORK_IDS = [
  "SOC2",
  "ISO27001",
  "SOX",
  "GDPR",
  "NIST_CSF",
] as const;

export type FrameworkId = (typeof FRAMEWORK_IDS)[number];

export type CanonicalControl = {
  id: string;
  name: string;
  domain: string;
  /** Control codes per framework that applies; omit framework if not mapped. */
  frameworks: Partial<Record<FrameworkId, string>>;
};

export const FRAMEWORK_LIBRARY_META: Record<
  FrameworkId,
  { title: string; shortDescription: string }
> = {
  SOC2: {
    title: "SOC 2",
    shortDescription:
      "Trust Services Criteria for security, availability, processing integrity, confidentiality, and privacy.",
  },
  ISO27001: {
    title: "ISO 27001",
    shortDescription:
      "Information security management system (ISMS) requirements and controls.",
  },
  SOX: {
    title: "SOX",
    shortDescription:
      "Internal controls over financial reporting (ICFR) for US public companies.",
  },
  GDPR: {
    title: "GDPR",
    shortDescription: "EU data protection principles and data subject rights.",
  },
  NIST_CSF: {
    title: "NIST CSF",
    shortDescription:
      "NIST Cybersecurity Framework — Identify, Protect, Detect, Respond, Recover.",
  },
};

/** Minimal canonical catalog with intentional overlap for cross-framework demo (Story 2.4). */
export const CANONICAL_CONTROLS: readonly CanonicalControl[] = [
  {
    id: "c-access-logical",
    name: "Logical access to systems and data",
    domain: "Access Control",
    frameworks: { SOC2: "CC6.1", ISO27001: "A.9.2.1" },
  },
  {
    id: "c-change-mgmt",
    name: "Change management",
    domain: "Operations",
    frameworks: { SOC2: "CC8.1", ISO27001: "A.12.1.2", NIST_CSF: "PR.IP-1" },
  },
  {
    id: "c-risk-program",
    name: "Risk assessment program",
    domain: "Risk",
    frameworks: { SOC2: "CC3.1", NIST_CSF: "ID.RA-1" },
  },
  {
    id: "c-vendor",
    name: "Vendor and supply chain risk",
    domain: "Third Party",
    frameworks: { SOC2: "CC9.2", ISO27001: "A.15.1.1" },
  },
  {
    id: "c-soc-env",
    name: "Control environment and oversight",
    domain: "Governance",
    frameworks: { SOC2: "CC1.1" },
  },
  {
    id: "c-iso-ops",
    name: "Operational procedures and responsibilities",
    domain: "Operations",
    frameworks: { ISO27001: "A.12.1.1" },
  },
  {
    id: "c-sox-itgc",
    name: "IT general controls over financial systems",
    domain: "Financial Reporting",
    frameworks: { SOX: "ITGC-404" },
  },
  {
    id: "c-gdpr-art32",
    name: "Security of processing",
    domain: "Privacy",
    frameworks: { GDPR: "Art.32" },
  },
  {
    id: "c-nist-govern",
    name: "Governance of cybersecurity risk",
    domain: "Governance",
    frameworks: { NIST_CSF: "GV.OC-1" },
  },
];

export function controlCountForFramework(frameworkId: FrameworkId): number {
  return CANONICAL_CONTROLS.filter((c) => c.frameworks[frameworkId] != null).length;
}

/** Documented heuristic until product replaces it: ~15% of controls as estimated gaps for locked preview. */
export function estimatedGapsForFramework(frameworkId: FrameworkId): number {
  const n = controlCountForFramework(frameworkId);
  return Math.max(1, Math.floor(n * 0.15));
}

export type MergedControlRow = {
  canonicalId: string;
  name: string;
  domain: string;
  /** Sorted framework refs: `FRAMEWORK:code` matching Story 3.1 style. */
  frameworkRefs: string[];
  /**
   * Lexicographic first among activated frameworks that map this canonical control — used for
   * `control_items.framework` / `control_code`. Not stable across activation changes (expected:
   * informational ordering only until Story 3.1 editing conventions).
   */
  primaryFramework: FrameworkId;
  /** Control code for primary framework (control_code column). */
  primaryControlCode: string;
};

function frameworkRefString(frameworkId: FrameworkId, code: string): string {
  return `${frameworkId}:${code}`;
}

/** Build deduplicated rows for all canonical controls that apply to any selected framework. */
export function mergeCanonicalControlsForFrameworks(
  selectedFrameworkIds: FrameworkId[]
): MergedControlRow[] {
  const set = new Set(selectedFrameworkIds);
  const rows: MergedControlRow[] = [];
  for (const c of CANONICAL_CONTROLS) {
    const refs: string[] = [];
    for (const fid of FRAMEWORK_IDS) {
      if (!set.has(fid)) continue;
      const code = c.frameworks[fid];
      if (code) refs.push(frameworkRefString(fid, code));
    }
    if (refs.length === 0) continue;
    refs.sort();
    const frameworksPresent = FRAMEWORK_IDS.filter((fid) => set.has(fid) && c.frameworks[fid]);
    const primaryFramework = [...frameworksPresent].sort()[0]!;
    const primaryControlCode = c.frameworks[primaryFramework] ?? "";
    rows.push({
      canonicalId: c.id,
      name: c.name,
      domain: c.domain,
      frameworkRefs: refs,
      primaryFramework,
      primaryControlCode,
    });
  }
  return rows;
}

/**
 * Overlap % = canonical controls that map to 2+ selected frameworks / total activated canonical rows.
 * Returns null when fewer than 2 frameworks selected (denominator / UX policy).
 */
export function computeOverlapPercent(
  selectedFrameworkIds: FrameworkId[],
  mergedRows: MergedControlRow[]
): number | null {
  if (selectedFrameworkIds.length < 2 || mergedRows.length === 0) return null;
  const selected = new Set(selectedFrameworkIds);
  let multi = 0;
  for (const row of mergedRows) {
    const distinctFw = new Set(
      row.frameworkRefs.map((r) => r.split(":")[0]).filter(Boolean) as FrameworkId[]
    );
    const inSelected = [...distinctFw].filter((id) => selected.has(id));
    if (inSelected.length >= 2) multi += 1;
  }
  return Math.floor((100 * multi) / mergedRows.length);
}

/** Parsed segment from `framework_refs` JSON string entries (`FRAMEWORK:code`). */
export type ParsedFrameworkRef = {
  frameworkId: FrameworkId;
  /** Requirement / clause reference as stored after the colon. */
  code: string;
};

const FRAMEWORK_ID_SET = new Set<string>(FRAMEWORK_IDS);

function isFrameworkId(s: string): s is FrameworkId {
  return FRAMEWORK_ID_SET.has(s);
}

/**
 * Parses a single `SOC2:CC6.1`-style ref. Invalid segments return null (caller may skip).
 */
export function parseFrameworkRefString(ref: string): ParsedFrameworkRef | null {
  const idx = ref.indexOf(":");
  if (idx <= 0) return null;
  const fw = ref.slice(0, idx);
  const code = ref.slice(idx + 1).trim();
  if (!code || !isFrameworkId(fw)) return null;
  return { frameworkId: fw, code };
}

/** Parses all refs in stored order; invalid entries are skipped. */
export function parseFrameworkRefsArray(refs: string[]): ParsedFrameworkRef[] {
  const out: ParsedFrameworkRef[] = [];
  for (const r of refs) {
    const p = parseFrameworkRefString(r);
    if (p) out.push(p);
  }
  return out;
}

/** Distinct framework ids appearing in refs. */
export function distinctFrameworkIdsFromRefs(refs: string[]): FrameworkId[] {
  const s = new Set<FrameworkId>();
  for (const p of parseFrameworkRefsArray(refs)) {
    s.add(p.frameworkId);
  }
  return [...s].sort();
}

/** True when refs map to two or more distinct frameworks (Story 2.4 overlap-style “shared”). */
export function isControlSharedAcrossFrameworks(refs: string[]): boolean {
  return distinctFrameworkIdsFromRefs(refs).length >= 2;
}

/**
 * Count of unified controls that apply to `frameworkId`, include ≥2 frameworks in refs,
 * and pass optional `filterApply` when narrowing the row set (e.g. framework-specific list).
 */
export function sharedControlsCountForFramework(
  frameworkId: FrameworkId,
  frameworkRefsPerRow: string[][]
): number {
  let n = 0;
  for (const refs of frameworkRefsPerRow) {
    const ids = distinctFrameworkIdsFromRefs(refs);
    if (!ids.includes(frameworkId)) continue;
    if (ids.length >= 2) n++;
  }
  return n;
}

export type IncrementalCoverageResult = {
  /** Unique canonical controls already present before activation that new framework(s) also require. */
  alreadyCoveredCount: number;
  /** Per newly activated framework: canonical overlap count (includes overlaps counted in aggregate). */
  perFramework: Partial<Record<FrameworkId, number>>;
};

/**
 * Coverage when adding `newlyActivatedFrameworkIds`: counts canonical rows that **already existed**
 * in the tenant and are **required** by at least one newly activated framework (per Story 2.6).
 */
export function computeIncrementalCoverage(
  existingCanonicalIds: ReadonlySet<string>,
  newlyActivatedFrameworkIds: FrameworkId[]
): IncrementalCoverageResult {
  const perFramework: Partial<Record<FrameworkId, number>> = {};
  const aggregate = new Set<string>();

  for (const fid of newlyActivatedFrameworkIds) {
    let n = 0;
    for (const c of CANONICAL_CONTROLS) {
      if (c.frameworks[fid] == null) continue;
      if (existingCanonicalIds.has(c.id)) {
        n++;
        aggregate.add(c.id);
      }
    }
    perFramework[fid] = n;
  }

  return {
    alreadyCoveredCount: aggregate.size,
    perFramework,
  };
}

/** Human-readable label for notification copy when activating one or more frameworks. */
export function formatNewFrameworksLabel(frameworkIds: FrameworkId[]): string {
  if (frameworkIds.length === 0) return "";
  if (frameworkIds.length === 1) return FRAMEWORK_LIBRARY_META[frameworkIds[0]!].title;
  const titles = frameworkIds.map((id) => FRAMEWORK_LIBRARY_META[id].title);
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
}

/** Keyword / phrase rules — deterministic, case-insensitive (tests rely on stability). */
export function computeRecommendedFrameworks(
  inference: FingerprintInferencePayload
): FrameworkId[] {
  const textParts: string[] = [
    inference.industryClassification.title,
    inference.industryClassification.detail,
    ...inference.regulatoryObligations.flatMap((o) => [o.title, o.detail]),
    ...inference.riskDomains.flatMap((r) => [r.title, r.detail]),
  ];
  const blob = textParts.join(" ").toLowerCase();

  const scores: Record<FrameworkId, number> = {
    SOC2: 0,
    ISO27001: 0,
    SOX: 0,
    GDPR: 0,
    NIST_CSF: 0,
  };

  const bump = (id: FrameworkId, weight: number) => {
    scores[id] += weight;
  };

  if (/\bsoc\b|\bsoc\s*2\b|trust services|type\s*ii/i.test(blob)) bump("SOC2", 3);
  if (/iso\s*27001|isms|\ba\.12\b/i.test(blob)) bump("ISO27001", 3);
  /** Avoid bare `\bsox\b` (matches "Red Sox"). Prefer regulatory SOX signals. */
  if (
    /sarbanes|oxley|icfr|financial reporting|internal control.*financial|\bsec\b.*(?:filing|registration)|section\s*404/i.test(
      blob
    )
  ) {
    bump("SOX", 3);
  }
  /** Avoid standalone `\beu\b` (matches "eu-style"). GDPR keyword wins. */
  if (
    /\bgdpr\b|data subject|personal data|privacy regulation|\beu[\s-]*(?:gdpr|privacy|law)/i.test(blob)
  ) {
    bump("GDPR", 3);
  }
  if (/\bnist\b|csf|cybersecurity framework/i.test(blob)) bump("NIST_CSF", 3);

  if (/saas|software|cloud|b2b/i.test(blob)) bump("SOC2", 1);
  if (/health|hipaa|patient/i.test(blob)) {
    bump("ISO27001", 1);
    bump("GDPR", 1);
  }
  /** Avoid bare `financial` (matches "financial advice" disclaimers); require SOX-adjacent phrases. */
  if (
    /\bfinancial\s+(?:reporting|services|industry|sector|institutions?)\b|public\s+company|revenue\s+recognition|\bbanking\b/i.test(
      blob
    )
  ) {
    bump("SOX", 2);
  }

  const ranked = FRAMEWORK_IDS.filter((id) => scores[id] > 0).sort((a, b) => {
    const d = scores[b]! - scores[a]!;
    if (d !== 0) return d;
    return a.localeCompare(b);
  });

  return ranked.length > 0 ? ranked : ["SOC2"];
}
