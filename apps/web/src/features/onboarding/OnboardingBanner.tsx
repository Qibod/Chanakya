"use client";

import { useOnboardingProgress } from "./useOnboardingProgress";

/** Compact setup banner for the authenticated app shell when onboarding is incomplete. */
export function OnboardingBanner() {
  const q = useOnboardingProgress();

  if (q.isLoading || q.isError || !q.data) return null;

  const { completedCount, total, allComplete, dismissedAt } = q.data;
  if (allComplete || dismissedAt) return null;

  return (
    <div
      className="border-border bg-card mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
      role="status"
    >
      <p className="text-foreground">
        <span className="font-semibold">{completedCount}</span> of{" "}
        <span className="font-semibold">{total}</span> setup steps complete
      </p>
      <p className="text-foreground-secondary text-xs">
        Finish setup from the onboarding pages or use the actions below on your dashboard.
      </p>
    </div>
  );
}
