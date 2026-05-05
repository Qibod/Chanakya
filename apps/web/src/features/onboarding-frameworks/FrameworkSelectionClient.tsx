"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OnboardingStepHelp } from "@/features/onboarding/OnboardingStepHelp";
import { ONBOARDING_HELP_COPY } from "@/features/onboarding/onboardingHelpCopy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FrameworkBadge } from "@grc/ui";

type FrameworkId = "SOC2" | "ISO27001" | "SOX" | "GDPR" | "NIST_CSF";

const COVERAGE_NOTICE_STORAGE_KEY = "grc_framework_activation_coverage_notice";

type LibraryResponse = {
  tier: "starter" | "growth" | "scale";
  maxSelectable: number;
  recommended: FrameworkId[];
  frameworks: Array<{
    id: FrameworkId;
    title: string;
    shortDescription: string;
    controlCount: number;
    estimatedGaps: number;
    recommended: boolean;
    alreadyActivated: boolean;
  }>;
};

async function fetchLibrary(): Promise<{ data: LibraryResponse }> {
  const res = await fetch("/api/v1/frameworks/library", { credentials: "same-origin" });
  const body = (await res.json()) as { data?: LibraryResponse; error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message ?? "Could not load frameworks");
  if (!body.data) throw new Error("Invalid response");
  return { data: body.data };
}

async function postActivate(ids: FrameworkId[]): Promise<{
  activated: FrameworkId[];
  controlsCreated: number;
  overlapPercent: number | null;
  alreadyCoveredCount: number;
  frameworkLabel: string;
}> {
  const res = await fetch("/api/v1/frameworks/activate", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frameworkIds: ids }),
  });
  const body = (await res.json()) as {
    data?: {
      activated: FrameworkId[];
      controlsCreated: number;
      overlapPercent: number | null;
      alreadyCoveredCount: number;
      frameworkLabel: string;
    };
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(body.error?.message ?? "Activation failed");
  if (!body.data) throw new Error("Invalid response");
  return body.data;
}

export function FrameworkSelectionClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<FrameworkId>>(new Set());
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);
  const initSelectionRef = useRef(false);

  const q = useQuery({
    queryKey: ["framework-library"],
    queryFn: async () => {
      const r = await fetchLibrary();
      return r.data;
    },
  });

  const maxSel = q.data?.maxSelectable ?? 5;
  const tier = q.data?.tier ?? "starter";

  useEffect(() => {
    if (!q.data || initSelectionRef.current) return;
    initSelectionRef.current = true;
    const rec = q.data.frameworks
      .filter((f) => f.recommended && !f.alreadyActivated)
      .map((f) => f.id);
    if (tier === "starter") {
      const first = rec[0] ?? "SOC2";
      setSelected(new Set([first]));
    } else {
      setSelected(new Set(rec.slice(0, Math.min(maxSel, rec.length))));
    }
  }, [q.data, tier, maxSel]);

  const mutation = useMutation({
    mutationFn: postActivate,
    onSuccess: async (data) => {
      try {
        sessionStorage.setItem("grc_onboarding_framework_complete", "1");
        if (data.overlapPercent != null) {
          sessionStorage.setItem("grc_onboarding_overlap_percent", String(data.overlapPercent));
        } else {
          sessionStorage.removeItem("grc_onboarding_overlap_percent");
        }
      } catch {
        /* ignore */
      }
      await queryClient.invalidateQueries({ queryKey: ["controls-list"] });
      await queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });

      if (data.alreadyCoveredCount > 0) {
        try {
          sessionStorage.setItem(
            COVERAGE_NOTICE_STORAGE_KEY,
            JSON.stringify({
              count: data.alreadyCoveredCount,
              label: data.frameworkLabel,
              createdAt: new Date().toISOString(),
            })
          );
        } catch {
          // ignore
        }
      }

      router.push("/onboarding/integrations");
    },
  });

  function toggle(id: FrameworkId, lockedPreview: boolean) {
    if (lockedPreview) {
      setUpgradePrompt(
        "Growth unlocks multiple frameworks and deeper integrations. Upgrade when you are ready — you can continue onboarding now."
      );
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (tier === "starter") {
          next.clear();
          next.add(id);
        } else if (next.size >= maxSel) {
          return prev;
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }

  function lockedPreviewCard(id: FrameworkId): boolean {
    if (!q.data) return false;
    if (tier !== "starter") return false;
    if (selected.size === 0) return false;
    return !selected.has(id);
  }

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[70vh] max-w-3xl flex-col gap-8 px-4 py-16"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Choose your compliance frameworks
          </h1>
          <OnboardingStepHelp content={ONBOARDING_HELP_COPY.frameworks} />
        </div>
        <p className="text-foreground-secondary mt-2 text-sm leading-relaxed">
          We&apos;ll populate your unified control library from our catalog. You can connect
          integrations on the next step.
        </p>
        {q.data && tier === "starter" && (
          <p className="text-foreground-secondary mt-2 text-sm">
            Starter includes <strong className="text-foreground">one active framework</strong>.
            Other frameworks show a read-only preview with estimated gaps — upgrade to Growth to
            activate more.
          </p>
        )}
      </div>

      {q.isLoading && <p className="text-foreground-secondary text-sm">Loading frameworks…</p>}
      {q.isError && (
        <p className="text-status-fail text-sm" role="alert">
          {(q.error as Error).message}
        </p>
      )}

      {upgradePrompt && (
        <div
          className="border-border bg-card rounded-lg border px-4 py-3 text-sm"
          role="status"
        >
          <p>{upgradePrompt}</p>
          <button
            type="button"
            className="text-accent mt-2 font-medium underline"
            onClick={() => setUpgradePrompt(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {q.data?.frameworks.map((f) => {
          const previewLocked = lockedPreviewCard(f.id);
          const isSelected = selected.has(f.id);
          const disabledActivate = f.alreadyActivated;

          return (
            <li key={f.id}>
              <button
                type="button"
                disabled={disabledActivate}
                aria-pressed={disabledActivate ? undefined : isSelected}
                aria-label={`${f.title}: ${isSelected ? "selected" : "not selected"}`}
                onClick={() => toggle(f.id, previewLocked)}
                className={`border-border w-full rounded-xl border px-4 py-4 text-left transition-colors ${
                  previewLocked ? "opacity-70" : ""
                } ${isSelected ? "ring-accent ring-2" : "hover:bg-card/80"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <FrameworkBadge framework={f.id} />
                  {f.recommended && (
                    <span className="bg-accent/15 text-accent rounded px-2 py-0.5 text-xs font-medium">
                      Recommended
                    </span>
                  )}
                  {f.alreadyActivated && (
                    <span className="text-foreground-secondary text-xs">Already activated</span>
                  )}
                  {previewLocked && (
                    <span className="text-foreground-secondary text-xs">
                      Preview — upgrade to activate
                    </span>
                  )}
                </div>
                <p className="text-foreground mt-2 font-medium">{f.title}</p>
                <p className="text-foreground-secondary mt-1 text-sm">{f.shortDescription}</p>
                <p className="text-foreground-secondary mt-2 text-xs">
                  {f.controlCount} controls in catalog · ~{f.estimatedGaps} estimated gaps if
                  inactive
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {mutation.error && (
        <p className="text-status-fail text-sm" role="alert">
          {(mutation.error as Error).message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={mutation.isPending || selected.size === 0 || q.isLoading}
          className="bg-accent text-background rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          onClick={() => mutation.mutate([...selected])}
        >
          {mutation.isPending ? "Activating…" : "Activate & continue"}
        </button>
        <Link href="/onboarding/fingerprint" className="text-accent text-sm underline">
          Back to fingerprint
        </Link>
      </div>

    </main>
  );
}
