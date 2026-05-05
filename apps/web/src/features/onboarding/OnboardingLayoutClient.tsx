"use client";

import type { ReactNode } from "react";
import { OnboardingChecklist } from "./OnboardingChecklist";

export function OnboardingLayoutClient({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:flex-row md:items-start md:gap-10">
      <div className="min-w-0 flex-1">{children}</div>
      <OnboardingChecklist />
    </div>
  );
}
