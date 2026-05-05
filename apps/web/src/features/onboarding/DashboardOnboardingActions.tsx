"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { OnboardingStepHelp } from "./OnboardingStepHelp";
import { ONBOARDING_HELP_COPY } from "./onboardingHelpCopy";
import { useOnboardingProgress } from "./useOnboardingProgress";

async function fetchControls(): Promise<{
  data: { total: number; items: Array<{ id: string; name: string }> };
}> {
  const res = await fetch("/api/v1/controls", { credentials: "same-origin" });
  const body = (await res.json()) as {
    data?: { total: number; items: Array<{ id: string; name: string }> };
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(body.error?.message ?? "Could not load controls");
  if (!body.data) throw new Error("Invalid response");
  return { data: body.data };
}

export function DashboardOnboardingActions() {
  const qc = useQueryClient();
  const progress = useOnboardingProgress();
  const controls = useQuery({
    queryKey: ["controls-list"],
    queryFn: async () => {
      const r = await fetchControls();
      return r.data;
    },
  });

  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  const firstControlId = controls.data?.items[0]?.id;

  const assignMutation = useMutation({
    mutationFn: async (controlId: string) => {
      const res = await fetch(`/api/v1/controls/${encodeURIComponent(controlId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignToSelf: true }),
      });
      const body = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(body.error?.message ?? "Assignment failed");
      return body;
    },
    onSuccess: async () => {
      setAssignMessage("You are now assigned to a control.");
      await qc.invalidateQueries({ queryKey: ["controls-list"] });
      await qc.invalidateQueries({ queryKey: ["onboarding-progress"] });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/onboarding/complete-step", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "first_report" }),
      });
      const body = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(body.error?.message ?? "Could not record summary step");
      return body;
    },
    onSuccess: async () => {
      setReportMessage("Summary step recorded. Full reporting ships in a later release.");
      await qc.invalidateQueries({ queryKey: ["onboarding-progress"] });
    },
  });

  const showAssign = Boolean(progress.data?.steps && !progress.data.steps.assign_control);
  const showReport = Boolean(progress.data?.steps && !progress.data.steps.first_report);

  if (progress.isLoading || !progress.data?.steps) return null;
  if (!showAssign && !showReport) return null;

  return (
    <div className="border-border bg-card/60 mb-6 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-foreground text-sm font-semibold">Finish setup</h2>
      </div>
      <div className="mt-4 flex flex-col gap-4 md:flex-row md:flex-wrap">
        {showAssign && (
          <div className="flex min-w-[220px] flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-foreground text-sm font-medium">Assign yourself to a control</span>
              <OnboardingStepHelp content={ONBOARDING_HELP_COPY.dashboard_assign} />
            </div>
            <button
              type="button"
              disabled={assignMutation.isPending || !firstControlId}
              className="bg-accent text-background rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              onClick={() => firstControlId && assignMutation.mutate(firstControlId)}
            >
              {assignMutation.isPending ? "Saving…" : "Assign me to the first control"}
            </button>
            {!firstControlId && controls.isSuccess && (
              <p className="text-foreground-secondary text-xs">Activate a framework to load controls.</p>
            )}
            {assignMessage && <p className="text-foreground-secondary text-xs">{assignMessage}</p>}
            {assignMutation.error && (
              <p className="text-status-fail text-xs">{(assignMutation.error as Error).message}</p>
            )}
          </div>
        )}
        {showReport && (
          <div className="flex min-w-[220px] flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-foreground text-sm font-medium">Record summary step</span>
              <OnboardingStepHelp content={ONBOARDING_HELP_COPY.dashboard_report} />
            </div>
            <button
              type="button"
              disabled={reportMutation.isPending}
              className="border-border text-foreground rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
              onClick={() => reportMutation.mutate()}
            >
              {reportMutation.isPending ? "Recording…" : "Generate compliance summary (placeholder)"}
            </button>
            {reportMessage && <p className="text-foreground-secondary text-xs">{reportMessage}</p>}
            {reportMutation.error && (
              <p className="text-status-fail text-xs">{(reportMutation.error as Error).message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
