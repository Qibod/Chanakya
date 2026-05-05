"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";

const actionSpotlightVariants = cva("relative rounded-xl border p-4", {
  variants: {
    variant: {
      urgent: "border-status-warn/30 bg-status-warn/5",
      normal: "border-border bg-card/60",
      complete: "border-status-pass/30 bg-status-pass/5",
    },
  },
  defaultVariants: { variant: "normal" },
});

function stripComplianceCodes(input: string): string {
  return (
    input
      .replace(/\bSOC2:\s*[A-Z0-9.\-]+\b/gi, "")
      .replace(/\bISO27001:\s*[A-Z0-9.\-]+\b/gi, "")
      .replace(/\bCC\d+(\.\d+)?\b/gi, "")
      .replace(/\bA\.\d+(\.\d+)*\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  return reduced;
}

export type ActionSpotlightProps = VariantProps<typeof actionSpotlightVariants> & {
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  whyNeededLabel?: string;
  whyNeededText?: string | null;
  onWhyNeededToggle?: (open: boolean) => void;
  className?: string;
};

export function ActionSpotlight({
  variant = "normal",
  title,
  description,
  primaryLabel,
  onPrimary,
  whyNeededLabel = "Why is this needed?",
  whyNeededText,
  onWhyNeededToggle,
  className,
}: ActionSpotlightProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);

  const safeTitle = useMemo(() => stripComplianceCodes(title), [title]);
  const safeDescription = useMemo(() => stripComplianceCodes(description), [description]);
  const safeWhy = useMemo(
    () => (whyNeededText == null ? null : stripComplianceCodes(whyNeededText)),
    [whyNeededText]
  );

  const showBloom = variant === "complete" && !reducedMotion;

  return (
    <section className={clsx(actionSpotlightVariants({ variant }), className)}>
      {showBloom ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-3 -right-3 h-10 w-10 rounded-full bg-status-pass/20 blur-md"
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-foreground truncate text-sm font-semibold">{safeTitle}</h3>
          <p className="text-foreground-secondary mt-1 text-sm leading-relaxed">{safeDescription}</p>
        </div>

        {variant === "complete" ? (
          <span
            className={clsx(
              "inline-flex h-8 w-8 items-center justify-center rounded-full",
              "bg-[var(--status-pass-bg)] text-[var(--status-pass)]"
            )}
            aria-label="Task complete"
            title="Complete"
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={clsx(
            "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50",
            variant === "urgent" || variant === "normal"
              ? "bg-accent text-background"
              : "bg-surface-overlay text-foreground"
          )}
          onClick={onPrimary}
          disabled={variant === "complete"}
        >
          {primaryLabel}
        </button>

        {variant !== "complete" ? (
          <button
            type="button"
            className="text-foreground-secondary hover:text-foreground text-sm underline"
            aria-expanded={open}
            onClick={() => {
              const next = !open;
              setOpen(next);
              onWhyNeededToggle?.(next);
            }}
          >
            {whyNeededLabel}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="border-border bg-surface-overlay/40 mt-3 rounded-lg border p-3">
          <p className="text-foreground-secondary text-sm leading-relaxed">
            {safeWhy ?? "Loading…"}
          </p>
        </div>
      ) : null}
    </section>
  );
}

