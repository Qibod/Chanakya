"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { IntegrationsOverlapBanner } from "@/app/(onboarding)/onboarding/integrations/IntegrationsOverlapBanner";
import { FrameworkCoverageNoticeBanner } from "@/app/(onboarding)/onboarding/integrations/FrameworkCoverageNoticeBanner";
import { OnboardingStepHelp } from "@/features/onboarding/OnboardingStepHelp";
import { ONBOARDING_HELP_COPY } from "@/features/onboarding/onboardingHelpCopy";

export function OnboardingIntegrationsClient() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const recordIntegration = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/onboarding/complete-step", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "integration" }),
      });
      const body = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(body.error?.message ?? "Could not save progress");
      return body;
    },
    onSuccess: async () => {
      setMsg("Connected step recorded. Full connector catalog lives under Integrations.");
      setErr(null);
      await qc.invalidateQueries({ queryKey: ["onboarding-progress"] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[50vh] max-w-lg flex-col gap-6 px-4 py-16"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Connect your first integration
        </h1>
        <OnboardingStepHelp content={ONBOARDING_HELP_COPY.integrations} />
      </div>
      <FrameworkCoverageNoticeBanner />
      <IntegrationsOverlapBanner />
      <p className="text-foreground-secondary text-sm leading-relaxed">
        Automate evidence collection by connecting tools your organisation already uses — Okta, AWS,
        Jira, and more. You can add integrations anytime from the sidebar.
      </p>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={recordIntegration.isPending}
          className="bg-accent text-background w-fit rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          onClick={() => recordIntegration.mutate()}
        >
          {recordIntegration.isPending ? "Saving…" : "I’ve connected a tool — continue setup"}
        </button>
        {msg && <p className="text-foreground-secondary text-xs">{msg}</p>}
        {err && (
          <p className="text-status-fail text-xs" role="alert">
            {err}
          </p>
        )}
        <p className="text-foreground-secondary text-xs">
          This records onboarding progress only. Production connectors ship with the integrations
          roadmap.
        </p>
      </div>
      <ul className="text-accent flex flex-col gap-3 text-sm font-medium">
        <li>
          <Link href="/integrations" className="underline hover:text-accent-hover">
            Open integrations
          </Link>
        </li>
        <li>
          <Link href="/dashboard" className="underline hover:text-accent-hover">
            Go to dashboard
          </Link>
        </li>
        <li>
          <Link href="/onboarding/fingerprint" className="underline hover:text-accent-hover">
            Back to fingerprint review
          </Link>
        </li>
      </ul>
    </main>
  );
}
