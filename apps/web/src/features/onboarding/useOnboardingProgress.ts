"use client";

import { useQuery } from "@tanstack/react-query";
import type { OnboardingProgressData } from "@grc/types";

async function fetchProgress(): Promise<{ data: OnboardingProgressData }> {
  const res = await fetch("/api/v1/onboarding/progress", { credentials: "same-origin" });
  const body = (await res.json()) as {
    data?: OnboardingProgressData;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(body.error?.message ?? "Could not load onboarding progress");
  if (!body.data) throw new Error("Invalid response");
  return { data: body.data };
}

export function useOnboardingProgress() {
  return useQuery({
    queryKey: ["onboarding-progress"],
    queryFn: async () => {
      const r = await fetchProgress();
      return r.data;
    },
  });
}
