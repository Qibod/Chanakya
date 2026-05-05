"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionSpotlight } from "@grc/ui";
import { useMemo, useState } from "react";

type MyTasksResponse = {
  data: {
    summary: { taskCount: number; automatedCount: number };
    tasks: Array<{
      controlId: string;
      assignmentId: string;
      title: string;
      description: string;
      dueDate: string | null;
      status: "todo" | "complete";
    }>;
  };
  error?: { message?: string };
};

async function fetchMyTasks(): Promise<MyTasksResponse["data"]> {
  const res = await fetch("/api/v1/my-tasks", { credentials: "same-origin" });
  const body = (await res.json()) as MyTasksResponse;
  if (!res.ok) throw new Error(body.error?.message ?? "Could not load tasks");
  if (!body.data) throw new Error("Invalid response");
  return body.data;
}

async function fetchWhyNeeded(controlId: string): Promise<{ text: string; generatedAt: string }> {
  const res = await fetch(`/api/v1/my-tasks/${encodeURIComponent(controlId)}/why-needed`, {
    method: "POST",
    credentials: "same-origin",
  });
  const body = (await res.json()) as { data?: { text: string; generatedAt: string }; error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message ?? "Could not load explanation");
  if (!body.data) throw new Error("Invalid response");
  return body.data;
}

async function completeTask(controlId: string, evidenceText: string): Promise<void> {
  const res = await fetch(`/api/v1/my-tasks/${encodeURIComponent(controlId)}/complete`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evidenceText }),
  });
  const body = (await res.json()) as { data?: unknown; error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message ?? "Could not complete task");
}

export function MyTasksClient() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-tasks"],
    queryFn: fetchMyTasks,
    retry: false,
  });

  const [whyByControlId, setWhyByControlId] = useState<Record<string, string | null | undefined>>(
    {}
  );
  const [reviewOpenById, setReviewOpenById] = useState<Record<string, boolean>>({});
  const [evidenceTextById, setEvidenceTextById] = useState<Record<string, string>>({});

  const whyMutation = useMutation({
    mutationFn: async (controlId: string) => await fetchWhyNeeded(controlId),
    onSuccess: (data, controlId) => {
      setWhyByControlId((prev) => ({ ...prev, [controlId]: data.text }));
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ controlId, evidenceText }: { controlId: string; evidenceText: string }) => {
      await completeTask(controlId, evidenceText);
    },
    onSuccess: async (_data, variables) => {
      qc.setQueryData<MyTasksResponse["data"]>(["my-tasks"], (old) => {
        if (!old) return old;
        const tasks = old.tasks.map((t) =>
          t.controlId === variables.controlId ? { ...t, status: "complete" as const } : t
        );
        const taskCount = tasks.filter((t) => t.status === "todo").length;
        return {
          ...old,
          summary: { ...old.summary, taskCount },
          tasks,
        };
      });
      await q.refetch();
    },
  });

  const model = q.data;
  const tasks = model?.tasks ?? [];

  const hero = useMemo(() => {
    const taskCount = model?.summary.taskCount ?? 0;
    const automatedCount = model?.summary.automatedCount ?? 0;
    return { taskCount, automatedCount };
  }, [model?.summary.automatedCount, model?.summary.taskCount]);

  if (q.isLoading) {
    return <p className="text-foreground-secondary mt-4 text-sm">Loading…</p>;
  }
  if (q.isError) {
    return (
      <p className="text-status-fail mt-4 text-sm" role="alert">
        {(q.error as Error).message}
      </p>
    );
  }

  return (
    <div className="max-w-3xl">
      {hero.taskCount > 0 ? (
        <header className="mb-6">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            You have {hero.taskCount} task{hero.taskCount === 1 ? "" : "s"} to complete
          </h1>
          <p className="text-foreground-secondary mt-2 text-sm">
            {hero.automatedCount} controls are automated — nothing needed from you
          </p>
        </header>
      ) : (
        <header className="mb-6">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            You&apos;re all clear. No tasks assigned to you right now.
          </h1>
        </header>
      )}

      <div className="space-y-4">
        {tasks.map((t) => {
          const whyText = whyByControlId[t.controlId];
          const isWhyLoading = whyMutation.isPending && whyMutation.variables === t.controlId;
          const reviewOpen = reviewOpenById[t.controlId] ?? false;
          const evidenceText = evidenceTextById[t.controlId] ?? "";
          const isCompleting =
            completeMutation.isPending && completeMutation.variables?.controlId === t.controlId;
          return (
            <div key={t.controlId}>
              <ActionSpotlight
                variant={t.status === "complete" ? "complete" : "normal"}
                title={t.title}
                description={t.description}
                primaryLabel="Start review →"
                onPrimary={() => setReviewOpenById((prev) => ({ ...prev, [t.controlId]: true }))}
                whyNeededText={isWhyLoading ? "Loading…" : (whyText ?? null)}
                onWhyNeededToggle={(open) => {
                  if (!open) return;
                  if (whyByControlId[t.controlId] != null) return;
                  whyMutation.mutate(t.controlId);
                }}
              />

              {t.status !== "complete" && reviewOpen ? (
                <div className="border-border bg-surface-elevated mt-3 rounded-xl border p-4">
                  <label
                    htmlFor={`evidence-${t.controlId}`}
                    className="text-foreground-secondary block text-xs font-medium uppercase tracking-wide"
                  >
                    Evidence note
                  </label>
                  <p className="text-foreground-secondary mt-1 text-sm">
                    Paste a short note describing what you checked (no compliance codes needed).
                  </p>
                  <textarea
                    id={`evidence-${t.controlId}`}
                    className="border-border bg-card text-foreground mt-3 w-full rounded-lg border px-3 py-2 text-sm"
                    rows={4}
                    value={evidenceText}
                    onChange={(e) =>
                      setEvidenceTextById((prev) => ({ ...prev, [t.controlId]: e.target.value }))
                    }
                  />
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="border-border text-foreground rounded-lg border px-4 py-2 text-sm font-medium"
                      onClick={() => setReviewOpenById((prev) => ({ ...prev, [t.controlId]: false }))}
                      disabled={isCompleting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="bg-accent text-background rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                      disabled={isCompleting || evidenceText.trim().length < 5}
                      onClick={() => completeMutation.mutate({ controlId: t.controlId, evidenceText })}
                    >
                      {isCompleting ? "Saving…" : "Submit evidence & mark complete"}
                    </button>
                  </div>
                  {completeMutation.error &&
                  completeMutation.variables?.controlId === t.controlId ? (
                    <p className="text-status-fail mt-2 text-sm" role="alert">
                      {(completeMutation.error as Error).message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

