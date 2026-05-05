"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FrameworkBadge, StatusChip } from "@grc/ui";
import {
  distinctFrameworkIdsFromRefs,
  isControlSharedAcrossFrameworks,
  sharedControlsCountForFramework,
  type FrameworkId,
} from "@grc/types";
import type { ListControlsResponse } from "@grc/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ControlsListItem = ListControlsResponse["items"][number];

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
  const [statusScope, setStatusScope] = useState<Array<"pass" | "warn" | "fail" | "pending" | "auto">>([]);
  const [ownerScope, setOwnerScope] = useState<"all" | "unassigned" | string>("all");
  const [collapsedDomains, setCollapsedDomains] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelReducedMotion, setPanelReducedMotion] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignOwnerId, setAssignOwnerId] = useState<string>("");
  const [assignDueDate, setAssignDueDate] = useState<string>("");
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const assignFirstFieldRef = useRef<HTMLSelectElement>(null);
  const assignOpenerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("controlLibrary.filters");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          frameworkScope?: FrameworkId | "all";
          statusScope?: Array<"pass" | "warn" | "fail" | "pending" | "auto">;
          ownerScope?: "all" | "unassigned" | string;
        };
        if (parsed.frameworkScope) setFrameworkScope(parsed.frameworkScope);
        if (Array.isArray(parsed.statusScope)) setStatusScope(parsed.statusScope);
        if (parsed.ownerScope) setOwnerScope(parsed.ownerScope);
      }

      const rawDomains = window.sessionStorage.getItem("controlLibrary.collapsedDomains");
      if (rawDomains) {
        const parsed = JSON.parse(rawDomains) as Record<string, boolean>;
        if (parsed && typeof parsed === "object") setCollapsedDomains(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        "controlLibrary.filters",
        JSON.stringify({ frameworkScope, statusScope, ownerScope })
      );
    } catch {
      // ignore
    }
  }, [frameworkScope, ownerScope, statusScope]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        "controlLibrary.collapsedDomains",
        JSON.stringify(collapsedDomains)
      );
    } catch {
      // ignore
    }
  }, [collapsedDomains]);

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


  const activated = libraryQ.data ?? [];
  const multiFramework = activated.length >= 2;

  function statusVariantFromApi(status: string): "pass" | "warn" | "fail" | "pending" | "auto" {
    const normalized = String(status ?? "").toLowerCase();
    if (normalized === "pass" || normalized === "passing") return "pass";
    if (normalized === "warn" || normalized === "warning" || normalized === "attention") return "warn";
    if (normalized === "fail" || normalized === "failing") return "fail";
    if (normalized === "auto" || normalized === "auto-monitored") return "auto";
    return "pending";
  }

  function initialsForOwner(value: string): string {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, "");
    const tail = cleaned.slice(-2);
    return (tail.length > 0 ? tail : "U").toUpperCase();
  }

  function formatLastUpdated(value: string | null): { label: string; title?: string } {
    if (!value) return { label: "Last updated: —" };
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return { label: "Last updated: —" };
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    const rel =
      diffSec < 60
        ? "just now"
        : diffMin < 60
          ? `${diffMin}m ago`
          : diffHr < 24
            ? `${diffHr}h ago`
            : diffDay < 7
              ? `${diffDay}d ago`
              : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    return { label: `Last updated: ${rel}`, title: d.toISOString() };
  }

  const filteredItems = useMemo(() => {
    const items = controlsQ.data ?? [];
    return items.filter((row) => {
      if (frameworkScope !== "all" && !frameworkIdsFromRefs(row.frameworkRefs).includes(frameworkScope)) {
        return false;
      }

      const variant = statusVariantFromApi(row.status);
      if (statusScope.length > 0 && !statusScope.includes(variant)) return false;

      if (ownerScope === "unassigned") return row.assignedTo == null;
      if (ownerScope !== "all") return row.assignedTo === ownerScope;

      return true;
    });
  }, [controlsQ.data, frameworkScope, ownerScope, statusScope]);

  const owners = useMemo(() => {
    const items = controlsQ.data ?? [];
    const set = new Set<string>();
    for (const row of items) {
      if (row.assignedTo) set.add(row.assignedTo);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [controlsQ.data]);

  const grouped = useMemo(() => {
    const stable = [...filteredItems].sort((a, b) => {
      const domainCmp = a.domain.localeCompare(b.domain);
      if (domainCmp !== 0) return domainCmp;
      return a.name.localeCompare(b.name);
    });
    const map = new Map<string, ControlsListItem[]>();
    for (const row of stable) {
      const key = row.domain || "Other";
      const existing = map.get(key);
      if (existing) existing.push(row);
      else map.set(key, [row]);
    }
    return Array.from(map.entries()).map(([domain, items]) => ({ domain, items }));
  }, [filteredItems]);

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
    setAssignOpen(false);
    setAssignOwnerId("");
    setAssignDueDate("");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus?.();
      openerRef.current = null;
    };
  }, [selectedId, onKeyDown, panelReducedMotion]);

  const qc = useQueryClient();
  const assignControl = useMutation({
    mutationFn: async () => {
      const controlId = selectedId;
      if (!controlId) throw new Error("No control selected");
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
      return body.data as {
        id: string;
        assignedTo: string;
        dueDate: string | null;
        status: string;
        instruction: string;
        instructionUpdatedAt: string;
        integrationsUsed: string[];
      };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["controls-list"] });
      await qc.invalidateQueries({ queryKey: ["control-detail", selectedId] });
      setAssignOpen(false);
    },
  });

  useEffect(() => {
    if (!assignOpen) return;
    requestAnimationFrame(() => assignFirstFieldRef.current?.focus());
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-foreground-secondary text-xs font-medium uppercase tracking-wide">
          Status
        </span>
        {(["pass", "warn", "fail", "pending", "auto"] as const).map((v) => {
          const active = statusScope.includes(v);
          return (
            <button
              key={v}
              type="button"
              aria-label={`Filter by status ${v}`}
              onClick={() =>
                setStatusScope((prev) =>
                  active ? prev.filter((x) => x !== v) : [...prev, v]
                )
              }
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-background"
                  : "bg-card text-foreground-secondary hover:bg-surface-overlay border-border border"
              }`}
            >
              {v}
            </button>
          );
        })}

        <span className="text-foreground-secondary ml-2 text-xs font-medium uppercase tracking-wide">
          Owner
        </span>
        <button
          type="button"
          aria-label="Show controls for all owners"
          onClick={() => setOwnerScope("all")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            ownerScope === "all"
              ? "bg-accent text-background"
              : "bg-card text-foreground-secondary hover:bg-surface-overlay border-border border"
          }`}
        >
          All
        </button>
        <button
          type="button"
          aria-label="Show unassigned controls"
          onClick={() => setOwnerScope("unassigned")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            ownerScope === "unassigned"
              ? "bg-accent text-background"
              : "bg-card text-foreground-secondary hover:bg-surface-overlay border-border border"
          }`}
        >
          Unassigned
        </button>
        {owners.slice(0, 10).map((id) => (
          <button
            key={id}
            type="button"
            aria-label={`Show controls assigned to ${id}`}
            onClick={() => setOwnerScope(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              ownerScope === id
                ? "bg-accent text-background"
                : "bg-card text-foreground-secondary hover:bg-surface-overlay border-border border"
            }`}
            title={id}
          >
            {initialsForOwner(id)}
          </button>
        ))}

        {(frameworkScope !== "all" || statusScope.length > 0 || ownerScope !== "all") && (
          <button
            type="button"
            className="text-foreground-secondary hover:text-foreground ml-2 text-sm underline"
            onClick={() => {
              setFrameworkScope("all");
              setStatusScope([]);
              setOwnerScope("all");
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {multiFramework && (
        <p className="text-foreground-secondary mb-4 text-sm" aria-live="polite">
          <span className="text-foreground font-medium">
            Shared controls
            {frameworkScope === "all" ? "" : ` (${frameworkScope})`}: {sharedCount}
          </span>
        </p>
      )}

      <div className="flex flex-col gap-4">
        {grouped.map(({ domain, items }) => {
          const collapsed = collapsedDomains[domain] ?? false;
          const regionId = `domain-${domain.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <section key={domain} className="border-border rounded-xl border bg-transparent">
              <button
                type="button"
                className="bg-card hover:bg-surface-overlay/60 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors"
                aria-expanded={!collapsed}
                aria-controls={regionId}
                onClick={() =>
                  setCollapsedDomains((prev) => ({
                    ...prev,
                    [domain]: !(prev[domain] ?? false),
                  }))
                }
              >
                <div>
                  <h2 className="text-foreground font-semibold">{domain}</h2>
                  <p className="text-foreground-secondary text-xs">
                    {items.length} control{items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-foreground-secondary text-sm">{collapsed ? "Show" : "Hide"}</span>
              </button>

              {!collapsed && (
                <ul id={regionId} className="flex flex-col gap-2 px-3 pb-3">
                  {items.map((row) => {
                    const shared = isControlSharedAcrossFrameworks(row.frameworkRefs);
                    const fwIds = frameworkIdsFromRefs(row.frameworkRefs);
                    const variant = statusVariantFromApi(row.status);
                    const updated = formatLastUpdated(row.updatedAt);
                    const statusLabel =
                      variant === "pass"
                        ? "Passing"
                        : variant === "warn"
                          ? "Needs attention"
                          : variant === "fail"
                            ? "Failing"
                            : variant === "auto"
                              ? "Auto-monitored"
                              : "Pending";
                    const ownerLabel = row.assignedTo
                      ? `Assigned to ${row.assignedTo}`
                      : "Unassigned";
                    const rowAriaLabel = `${row.name}. Status: ${statusLabel}. ${ownerLabel}. ${updated.label}. Open details.`;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          aria-label={rowAriaLabel}
                          onClick={() => setSelectedId(row.id)}
                          className="border-border bg-card hover:bg-surface-overlay/80 w-full rounded-xl border px-4 py-3 text-left transition-colors"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
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
                            <StatusChip variant={variant} size="sm" />
                          </div>

                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-foreground font-medium">{row.name}</p>
                            <div className="flex items-center gap-2">
                              {row.assignedTo ? (
                                <span
                                  className="bg-surface-overlay text-foreground inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                                  aria-label={`Assigned owner: ${row.assignedTo}`}
                                  title={row.assignedTo}
                                >
                                  {initialsForOwner(row.assignedTo)}
                                </span>
                              ) : (
                                <span
                                  className="text-foreground-secondary bg-surface-overlay inline-flex items-center rounded-full px-2 py-1 text-xs"
                                  aria-label="Unassigned"
                                >
                                  Unassigned
                                </span>
                              )}
                              <span
                                className="text-foreground-secondary text-xs"
                                aria-label={updated.label}
                                title={updated.title}
                              >
                                {updated.label}
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

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
                  <div className="mt-4 flex flex-wrap items-center gap-2">
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
                    {detailQ.data.assignment?.assignedTo ? (
                      <span className="text-foreground-secondary text-xs">
                        Assigned to: {detailQ.data.assignment.assignedTo}
                      </span>
                    ) : null}
                    {detailQ.data.instructionRegenerated ? (
                      <span className="text-foreground-secondary text-xs">
                        Instructions updated for current integrations
                      </span>
                    ) : null}
                  </div>
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
                      Select an owner and optional due date. Instructions are generated using connected integrations.
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
                      ref={assignFirstFieldRef}
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

                  <div>
                    <p className="text-foreground-secondary text-xs font-medium uppercase tracking-wide">
                      Connected integrations
                    </p>
                    <p className="text-foreground-secondary mt-2 text-sm">
                      {detailQ.data?.assignment?.integrationsUsed?.length
                        ? detailQ.data.assignment.integrationsUsed.join(", ")
                        : "Will be detected at assignment time"}
                    </p>
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
      )}
    </div>
  );
}
