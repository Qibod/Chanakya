import { DashboardOnboardingActions } from "@/features/onboarding/DashboardOnboardingActions";

import { DashboardClient } from "@/features/dashboard/DashboardClient";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-foreground text-2xl font-semibold">Dashboard</h1>
      <DashboardOnboardingActions />
      <DashboardClient />
    </div>
  );
}

