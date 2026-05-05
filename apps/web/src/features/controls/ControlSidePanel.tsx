"use client";

import { FrameworkBadge } from "@grc/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FrameworkId } from "@grc/types";
import { useEffect, useRef, useState } from "react";

type ControlDetail = {
  id: string;
  name: string;
  domain: string;
  status: string;
  frameworkRefs: string[];
  requirementDetails?: Array<{ frameworkId: FrameworkId; frameworkTitle: string; code: string }>;
  assignment?: {
    id: string;
    assignedTo: string;
    dueDate: string | null;
    instruction: string;
    instructionUpdatedAt: string | null;
    integrationsUsed: string[];
  } | null;
  instructionRegenerated?: boolean;
};

async function fetchControlDetail(id: string): Promise<ControlDetail> {
  const res = await fetch(`/api/v1/controls/${encodeURIComponent(id)}`, {
    credentials: "same-origin",
  });
  const body = (await res.json()) as { data?: ControlDetail; error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message ?? "Could not load control");
  if (!body.data) throw new Error("Invalid response");
  return body.data;
}

export function ControlSidePanel({
  controlId,
  openerRef,
  onDismiss,
  showAssign,
}: {
  controlId: string;
  openerRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
  showAssign?: boolean;
}) {
  const qc = useQueryClient();
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelReducedMotion, setPanelReducedMotion] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignOwnerId, setAssignOwnerId] = useState<string>("");
  const [assignDueDate, setAssignDueDate] = useState<string>("");
  const panelRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const assignFirstFieldRef = useRef<HTMLSelectElement | null>(null);
  const assignOpenerRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setPanelReducedMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const detailQ = useQuery({
    queryKey: ["control-detail", controlId],
    queryFn: () => fetchControlDetail(controlId),
  });

  const usersQ = useQuery({
    queryKey: ["tenant-users", "controlOwners"],
    queryFn: async () => {
      const res = await fetch("/api/v1/users?role=ControlOwner&limit=100", {
        credentials: "same-origin",
      });
      const body = (await res.json()) as {
        data?: Array<{ id: string; name: string | null; email: string; active: boolean; role: string | null }>;
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(body.error?.message ?? "Could not load users");
      return (body.data ?? []).filter((u) => u.active);
    },
    enabled: assignOpen,
    retry: false,
  });

  const assignControl = useMutation({
    mutationFn: async () => {
      if (!assignOwnerId) throw new Error("Select an owner");
      const res = await fetch(`/api/v1/controls/${encodeURIComponent(controlId)}/assign`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTo: assignOwnerId,
          dueDate: assignDueDate ? assignDueDate : null,
        }),
      });
      const body = (await res.json()) as { data?: unknown; error?: { message?: string } };
      if (!res.ok) throw new Error(body.error?.message ?? "Assignment failed");
      return body.data as unknown;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["controls-list"] });
      await qc.invalidateQueries({ queryKey: ["gaps-list"] });
      await qc.invalidateQueries({ queryKey: ["control-detail", controlId] });
      setAssignOpen(false);
    },
  });

  const closePanel = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (panelReducedMotion) {
      onDismiss();
      openerRef.current?.focus?.();
      return;
    }
    setPanelOpen(false);
    closeTimerRef.current = window.setTimeout(() => {
      onDismiss();
      openerRef.current?.focus?.();
      closeTimerRef.current = null;
    }, 220);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active == null)) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panelReducedMotion]);

  useEffect(() => {
    setPanelOpen(panelReducedMotion);
    if (!panelReducedMotion) {
      requestAnimationFrame(() => setPanelOpen(true));
    }
    requestAnimationFrame(() => closeBtnRef.current?.focus?.());
  }, [panelReducedMotion]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!assignOpen) return;
    requestAnimationFrame(() => assignFirstFieldRef.current?.focus?.());
    const onAssignKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setAssignOpen(false);
      }
    };
    document.addEventListener("keydown", onAssignKeyDown);
    return () => document.removeEventListener("keydown", onAssignKeyDown);
  }, [assignOpen]);

  useEffect(() => {
    if (assignOpen) return;
    assignOpenerRef.current?.focus?.();
    assignOpenerRef.current = null;
  }, [assignOpen]);

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={closePanel}
      />
      <aside
        ref={(el) => {
          panelRef.current = el;
        }}
        className={`border-border bg-surface-elevated fixed top-0 right-0 z-50 flex h-full w-full max-w-[400px] flex-col border-l shadow-xl ${
          panelReducedMotion
            ? "translate-x-0"
            : `transform transition-transform duration-200 ease-out ${
                panelOpen ? "translate-x-0" : "translate-x-full"
              }`
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="control-panel-title"
      >
        <div className="border-border flex items-start justify-between border-b px-4 py-3">
          <h2 id="control-panel-title" className="text-foreground pr-2 text-lg font-semibold">
            {detailQ.data?.name ?? "Control"}
          </h2>
          <button
            ref={(el) => {
              closeBtnRef.current = el;
            }}
            type="button"
            className="text-foreground-secondary hover:text-foreground text-sm underline"
            onClick={closePanel}
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {detailQ.isLoading && <p className="text-foreground-secondary text-sm">Loading details…</p>}
          {detailQ.isError && (
            <p className="text-status-fail text-sm" role="alert">
              {(detailQ.error as Error).message}
            </p>
          )}
          {detailQ.data && (
            <>
              <p className="text-foreground-secondary text-sm">{detailQ.data.domain}</p>
              <p className="text-foreground-secondary mt-1 text-xs">Status: {detailQ.data.status}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {showAssign && !detailQ.data.assignment?.assignedTo ? (
                  <button
                    type="button"
                    className="bg-accent text-background rounded-lg px-3 py-1.5 text-sm font-medium"
                    onClick={() => {
                      assignOpenerRef.current = document.activeElement as HTMLElement | null;
                      setAssignOpen(true);
                    }}
                  >
                    Assign
                  </button>
                ) : null}
                {detailQ.data.assignment?.assignedTo ? (
                  <span className="text-foreground-secondary text-xs">
                    Assigned to: {detailQ.data.assignment.assignedTo}
                    {detailQ.data.assignment.dueDate ? ` · Due ${detailQ.data.assignment.dueDate}` : ""}
                  </span>
                ) : (
                  <span className="text-foreground-secondary text-xs">Unassigned</span>
                )}
                {detailQ.data.instructionRegenerated ? (
                  <span className="text-foreground-secondary text-xs">
                    Instructions updated for current integrations
                  </span>
                ) : null}
              </div>

              {detailQ.data.assignment?.instruction ? (
                <div className="border-border bg-card/50 mt-4 rounded-lg border p-3">
                  <h3 className="text-foreground text-xs font-semibold uppercase tracking-wide">
                    Remediation
                  </h3>
                  <pre className="text-foreground-secondary mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {detailQ.data.assignment.instruction}
                  </pre>
                </div>
              ) : (
                <div className="border-border bg-card/50 mt-4 rounded-lg border p-3">
                  <h3 className="text-foreground text-xs font-semibold uppercase tracking-wide">
                    Next step
                  </h3>
                  <p className="text-foreground-secondary mt-2 text-sm leading-relaxed">
                    Assign this control to an owner to generate tailored remediation steps.
                  </p>
                </div>
              )}

              <h3 className="text-foreground mt-6 text-sm font-semibold">Framework requirements</h3>
              <ul className="mt-2 space-y-3">
                {(detailQ.data.requirementDetails ?? []).map((r) => (
                  <li key={`${r.frameworkId}-${r.code}`} className="flex flex-wrap items-center gap-2">
                    <FrameworkBadge framework={r.frameworkId} size="sm" />
                    <span className="text-foreground font-mono text-sm">{r.code}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>

      {assignOpen && (
        <>
          <button
            type="button"
            aria-label="Close assignment modal"
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={() => setAssignOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Assign control"
            className="border-border bg-surface-elevated fixed left-1/2 top-1/2 z-[70] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border p-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-foreground text-base font-semibold">Assign control</h3>
                <p className="text-foreground-secondary mt-1 text-sm">
                  Select an owner and optional due date. Instructions are generated using connected
                  integrations.
                </p>
              </div>
              <button
                type="button"
                className="text-foreground-secondary hover:text-foreground text-sm underline"
                onClick={() => setAssignOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="assign-owner"
                  className="text-foreground-secondary block text-xs font-medium uppercase tracking-wide"
                >
                  Owner
                </label>
                <select
                  id="assign-owner"
                  ref={(el) => {
                    assignFirstFieldRef.current = el;
                  }}
                  className="border-border bg-card text-foreground mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  value={assignOwnerId}
                  onChange={(e) => setAssignOwnerId(e.target.value)}
                >
                  <option value="">Select an owner…</option>
                  {(usersQ.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ? `${u.name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
                {usersQ.isLoading ? (
                  <p className="text-foreground-secondary mt-2 text-xs">Loading users…</p>
                ) : null}
                {usersQ.isError ? (
                  <p className="text-status-fail mt-2 text-xs" role="alert">
                    {(usersQ.error as Error).message}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="assign-due-date"
                  className="text-foreground-secondary block text-xs font-medium uppercase tracking-wide"
                >
                  Due date (optional)
                </label>
                <input
                  id="assign-due-date"
                  type="date"
                  className="border-border bg-card text-foreground mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="border-border text-foreground rounded-lg border px-4 py-2 text-sm font-medium"
                  onClick={() => setAssignOpen(false)}
                  disabled={assignControl.isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="bg-accent text-background rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                  disabled={assignControl.isPending || !assignOwnerId}
                  onClick={() => assignControl.mutate()}
                >
                  {assignControl.isPending ? "Saving…" : "Save assignment"}
                </button>
              </div>

              {assignControl.error ? (
                <p className="text-status-fail text-xs" role="alert">
                  {(assignControl.error as Error).message}
                </p>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}

