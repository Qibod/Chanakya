import type { ReactNode } from "react";
import { OnboardingLayoutClient } from "@/features/onboarding/OnboardingLayoutClient";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <OnboardingLayoutClient>{children}</OnboardingLayoutClient>;
}
