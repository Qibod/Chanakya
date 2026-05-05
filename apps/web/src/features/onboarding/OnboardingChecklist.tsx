"use client";

import { useMemo } from "react";
import type { OnboardingStepId } from "@grc/types";
import { useOnboardingProgress } from "./useOnboardingProgress";

const STEP_ORDER: Array<{ id: OnboardingStepId; label: string }> = [
  { id: "fingerprint", label: "Company fingerprinting" },
  { id: "framework", label: "Framework activation" },
  { id: "integration", label: "Connect first integration" },
  { id: "assign_control", label: "Assign first control" },
  { id: "first_report", label: "Generate first report" },
];

export function OnboardingChecklist() {
  const q = useOnboardingProgress();

  const nextStepId = useMemo(() => {
    if (!q.data?.steps) return null;
    const row = STEP_ORDER.find((s) => !q.data!.steps[s.id]);
    return row?.id ?? null;
  }, [q.data]);

  if (q.isLoading || q.isError) return null;

  const data = q.data;
  if (!data || data.dismissedAt) return null;

  return (
    <aside
      className="border-border bg-card/40 w-full shrink-0 rounded-lg border border-dashed p-4 md:max-w-xs"
      aria-label="Setup checklist"
    >
      <p className="text-foreground font-medium">Setup checklist</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        {STEP_ORDER.map(({ id, label }) => {
          const done = data.steps[id];
          const current = id === nextStepId && !done;
          return (
            <li
              key={id}
              className={
                current
                  ? "text-foreground font-semibold ring-accent rounded-md ring-2 ring-offset-2 ring-offset-transparent"
                  : "text-foreground-secondary"
              }
            >
              <span className="text-foreground">{done ? `${label} ✓` : label}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-foreground-secondary mt-3 text-xs">
        {data.completedCount} of {data.total} steps complete
      </p>
    </aside>
  );
}
