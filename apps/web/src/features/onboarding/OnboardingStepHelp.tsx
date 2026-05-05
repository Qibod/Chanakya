"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { OnboardingHelpContent } from "./onboardingHelpCopy";

type Props = {
  content: OnboardingHelpContent;
};

/** Accessible help popover (keyboard + Escape), aligned with fingerprint onboarding patterns. */
export function OnboardingStepHelp({ content }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  return (
    <span className="relative inline-flex align-middle">
      <button
        ref={btnRef}
        type="button"
        className="border-border text-foreground-secondary hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={headingId}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-labelledby={headingId}
            tabIndex={-1}
            className="border-border bg-card text-foreground absolute top-full left-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-lg border p-4 text-sm shadow-lg"
          >
            <h2 id={headingId} className="text-foreground font-semibold">
              {content.title}
            </h2>
            <p className="text-foreground-secondary mt-2 leading-relaxed">{content.body}</p>
            <p className="text-foreground mt-3 text-xs font-medium">Why this matters</p>
            <p className="text-foreground-secondary mt-1 text-xs leading-relaxed">
              {content.whyItMatters}
            </p>
            <button
              type="button"
              className="text-accent mt-3 text-xs font-medium underline"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </>
      )}
    </span>
  );
}
