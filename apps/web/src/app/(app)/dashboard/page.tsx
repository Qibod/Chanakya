import { DashboardOnboardingActions } from "@/features/onboarding/DashboardOnboardingActions";

import { DashboardControlsSummary } from "./DashboardControlsSummary";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-foreground text-2xl font-semibold">Dashboard</h1>
      <p className="text-foreground-secondary mt-2">
        Live posture and feeds ship in Story 3.2 — your control library is ready below.
      </p>
      <DashboardOnboardingActions />
      <DashboardControlsSummary />
    </div>
  );
}

