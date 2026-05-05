"use client";

import { useQuery } from "@tanstack/react-query";
import { FrameworkBadge } from "@grc/ui";
import {
  distinctFrameworkIdsFromRefs,
  isControlSharedAcrossFrameworks,
  sharedControlsCountForFramework,
  type FrameworkId,
} from "@grc/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ControlsListItem = {
  id: string;
  canonicalId: string;
  name: string;
  domain: string;
  status: string;
  framework: string;
  frameworkRefs: string[];
};

type LibraryFramework = {
  id: FrameworkId;
  title: string;
  alreadyActivated: boolean;
};

type ControlDetail = {
  id: string;
  name: string;
  domain: string;
  status: string;
  frameworkRefs: string[];
  requirementDetails: Array<{ frameworkId: FrameworkId; frameworkTitle: string; code: string }>;
};

function frameworkIdsFromRefs(refs: string[]): FrameworkId[] {
  return distinctFrameworkIdsFromRefs(refs);
}

async function fetchControls(): Promise<{ items: ControlsListItem[] }> {
  const res = await fetch("/api/v1/controls?limit=500", { credentials: "same-origin" });
  const body = (await res.json()) as {
    data?: { items: ControlsListItem[] };
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(body.error?.message ?? "Could not load controls");
  if (!body.data) throw new Error("Invalid response");
  return { items: body.data.items };
}

async function fetchLibraryFrameworks(): Promise<LibraryFramework[]> {
  const res = await fetch("/api/v1/frameworks/library", { credentials: "same-origin" });
  const body = (await res.json()) as {
    data?: { frameworks: LibraryFramework[] };
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(body.error?.message ?? "Could not load frameworks");
  if (!body.data) throw new Error("Invalid response");
  return body.data.frameworks.filter((f) => f.alreadyActivated);
}

async function fetchControlDetail(id: string): Promise<ControlDetail> {
  const res = await fetch(`/api/v1/controls/${encodeURIComponent(id)}`, {
    credentials: "same-origin",
  });
  const body = (await res.json()) as { data?: ControlDetail; error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message ?? "Could not load control");
  if (!body.data) throw new Error("Invalid response");
  return body.data;
}

export function ControlLibraryClient() {
  const [frameworkScope, setFrameworkScope] = useState<FrameworkId | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelReducedMotion, setPanelReducedMotion] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setPanelReducedMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const libraryQ = useQuery({
    queryKey: ["framework-library"],
    queryFn: fetchLibraryFrameworks,
  });

  const controlsQ = useQuery({
    queryKey: ["controls-list"],
    queryFn: async () => {
      const r = await fetchControls();
      return r.items;
    },
  });

  const detailQ = useQuery({
    queryKey: ["control-detail", selectedId],
    queryFn: () => fetchControlDetail(selectedId!),
    enabled: selectedId != null,
  });

  const activated = libraryQ.data ?? [];
  const multiFramework = activated.length >= 2;

  const filteredItems = useMemo(() => {
    const items = controlsQ.data ?? [];
    if (frameworkScope === "all") return items;
    return items.filter((row) => frameworkIdsFromRefs(row.frameworkRefs).includes(frameworkScope));
  }, [controlsQ.data, frameworkScope]);

  const refsMatrix = filteredItems.map((r) => r.frameworkRefs);

  const sharedCount =
    frameworkScope === "all"
      ? refsMatrix.filter((refs) => isControlSharedAcrossFrameworks(refs)).length
      : sharedControlsCountForFramework(frameworkScope, refsMatrix);

  const closePanel = useCallback(() => {
    if (panelReducedMotion) {
      setSelectedId(null);
      return;
    }
    setPanelOpen(false);
    window.setTimeout(() => setSelectedId(null), 200);
  }, [panelReducedMotion]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
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
    },
    [closePanel]
  );

  useEffect(() => {
    if (!selectedId) return;
    setPanelOpen(panelReducedMotion);
    if (!panelReducedMotion) {
      // ensure initial render applies translate-x-full before sliding in
      requestAnimationFrame(() => setPanelOpen(true));
    }
    openerRef.current = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", onKeyDown);
    closeBtnRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus?.();
      openerRef.current = null;
    };
  }, [selectedId, onKeyDown, panelReducedMotion]);

  return (
    <div className="relative">
      <header className="mb-6">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Control library</h1>
        <p className="text-foreground-secondary mt-2 max-w-2xl text-sm leading-relaxed">
          Unified controls — each row maps to one canonical control. Evidence you attach applies to
          every framework requirement listed for that control.
        </p>
      </header>

      {libraryQ.isLoading || controlsQ.isLoading ? (
        <p className="text-foreground-secondary text-sm">Loading…</p>
      ) : null}
      {(libraryQ.isError || controlsQ.isError) && (
        <p className="text-status-fail text-sm" role="alert">
          {(libraryQ.error ?? controlsQ.error) instanceof Error
            ? (libraryQ.error ?? controlsQ.error)?.message
            : "Error"}
        </p>
      )}

      {activated.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-foreground-secondary text-xs font-medium uppercase tracking-wide">
            Framework
          </span>
          <button
            type="button"
            aria-label="Show controls for all frameworks"
            onClick={() => setFrameworkScope("all")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              frameworkScope === "all"
                ? "bg-accent text-background"
                : "bg-card text-foreground-secondary hover:bg-surface-overlay border-border border"
            }`}
          >
            All
          </button>
          {activated.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-label={`Show controls mapped to ${f.title}`}
              onClick={() => setFrameworkScope(f.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                frameworkScope === f.id
                  ? "bg-accent text-background"
                  : "bg-card text-foreground-secondary hover:bg-surface-overlay border-border border"
              }`}
            >
              {f.title}
            </button>
          ))}
        </div>
      )}

      {multiFramework && (
        <p className="text-foreground-secondary mb-4 text-sm" aria-live="polite">
          <span className="text-foreground font-medium">
            Shared controls
            {frameworkScope === "all" ? "" : ` (${frameworkScope})`}: {sharedCount}
          </span>
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {filteredItems.map((row) => {
          const shared = isControlSharedAcrossFrameworks(row.frameworkRefs);
          const fwIds = frameworkIdsFromRefs(row.frameworkRefs);
          return (
            <li key={row.id}>
              <button
                type="button"
                aria-label={`Open details for ${row.name}`}
                onClick={() => setSelectedId(row.id)}
                className="border-border bg-card hover:bg-surface-overlay/80 w-full rounded-xl border px-4 py-3 text-left transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {fwIds.map((fid) => (
                    <FrameworkBadge key={fid} framework={fid} size="sm" />
                  ))}
                  {shared && (
                    <span className="text-foreground-secondary text-xs">
                      Shared across frameworks
                    </span>
                  )}
                </div>
                <p className="text-foreground mt-1 font-medium">{row.name}</p>
                <p className="text-foreground-secondary text-xs">
                  {row.domain} · {row.status}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {filteredItems.length === 0 && !controlsQ.isLoading && (
        <p className="text-foreground-secondary text-sm">
          {activated.length === 0
            ? "Activate a framework from onboarding to populate controls."
            : "No controls in this view."}
        </p>
      )}

      {selectedId && (
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
                ref={closeBtnRef}
                type="button"
                className="text-foreground-secondary hover:text-foreground text-sm underline"
                onClick={closePanel}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {detailQ.isLoading && (
                <p className="text-foreground-secondary text-sm">Loading details…</p>
              )}
              {detailQ.isError && (
                <p className="text-status-fail text-sm" role="alert">
                  {(detailQ.error as Error).message}
                </p>
              )}
              {detailQ.data && (
                <>
                  <p className="text-foreground-secondary text-sm">{detailQ.data.domain}</p>
                  <p className="text-foreground-secondary mt-1 text-xs">Status: {detailQ.data.status}</p>
                  <h3 className="text-foreground mt-6 text-sm font-semibold">Framework requirements</h3>
                  <ul className="mt-2 space-y-3">
                    {detailQ.data.requirementDetails.map((r) => (
                      <li key={`${r.frameworkId}-${r.code}`} className="flex flex-wrap items-center gap-2">
                        <FrameworkBadge framework={r.frameworkId} size="sm" />
                        <span className="text-foreground font-mono text-sm">{r.code}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-foreground-secondary mt-6 text-sm leading-relaxed">
                    One evidence upload for this control satisfies every requirement listed above —
                    they share a single control record in your library.
                  </p>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
