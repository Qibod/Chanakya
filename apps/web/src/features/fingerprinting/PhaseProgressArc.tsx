"use client";

const LABELS = ["Industry", "Obligations", "Controls", "Integrations"] as const;

export type PhaseProgressArcProps = {
  /** Highest phase (1–4) that has at least one line visible; 0 = none */
  activePhase: number;
};

const cx = 48;
const cy = 48;
const r = 32;
const sw = 6;

/** Four quarter-arc paths (top → right → bottom → left), starting from top center. */
const QUADRANT_PATHS = [
  `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`,
  `M ${cx + r} ${cy} A ${r} ${r} 0 0 1 ${cx} ${cy + r}`,
  `M ${cx} ${cy + r} A ${r} ${r} 0 0 1 ${cx - r} ${cy}`,
  `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx} ${cy - r}`,
] as const;

/**
 * Four-segment ring (top-right of stream). Each quarter lights up as its phase starts.
 */
export function PhaseProgressArc({ activePhase }: PhaseProgressArcProps) {
  return (
    <div
      className="pointer-events-none flex flex-col items-end gap-1"
      role="group"
      aria-label="Fingerprinting progress by phase"
    >
      <svg
        width="100"
        height="100"
        viewBox="0 0 96 96"
        className="shrink-0"
        aria-hidden
        focusable="false"
      >
        {QUADRANT_PATHS.map((d, i) => {
          const on = activePhase > i;
          return (
            <path
              key={LABELS[i]}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={sw}
              strokeLinecap="round"
              className={on ? "text-accent" : "text-foreground-muted"}
            />
          );
        })}
      </svg>
      <ul className="text-right text-[10px] leading-tight text-foreground-secondary">
        {LABELS.map((label, i) => (
          <li
            key={label}
            className={
              activePhase > i ? "font-medium text-accent" : "text-foreground-muted"
            }
          >
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
