"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FrameworkBadge, StatusChip } from "@grc/ui";
import {
  distinctFrameworkIdsFromRefs,
  isControlSharedAcrossFrameworks,
  ROLE_SATISFIES,
  sharedControlsCountForFramework,
  type FrameworkId,
} from "@grc/types";
import type { ListControlsResponse } from "@grc/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { ControlSidePanel } from "./ControlSidePanel";
import { statusVariantFromApi } from "@/lib/control-status";
import { useRole } from "@/features/auth/hooks";

type ControlsListItem = ListControlsResponse["items"][number];

type LibraryFramework = {
  id: FrameworkId;
  title: string;
  alreadyActivated: boolean;
};

function frameworkIdsFromRefs(refs: string[]): FrameworkId[] {
  return distinctFrameworkIdsFromRefs(refs);
}

/** UUID (incl. v7) pattern — used to avoid verbose screen-reader strings for clerk/db ids. */
const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Two-character badge from the end of an alphanumeric owner key (not human initials). */
function ownerBadgeFromId(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, "");
  const tail = cleaned.slice(-2);
  return (tail.length > 0 ? tail : "U").toUpperCase();
}

function ownerSummaryForAria(assignedTo: string): string {
  if (UUID_LIKE.test(assignedTo)) return "Assigned owner account";
  if (assignedTo.length > 28) return `Assigned owner, ID ending in ${assignedTo.slice(-6)}`;
  return `Assigned to ${assignedTo}`;
}

function ownerFilterAriaLabel(ownerId: string): string {
  if (UUID_LIKE.test(ownerId)) return "Show controls assigned to this owner account";
  return `Show controls assigned to ${ownerId}`;
}

const OWNER_FILTER_PREVIEW = 10;

function formatLastUpdated(value: string | null): { label: string; title?: string } {
  if (!value) return { label: "Last updated: —" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { label: "Last updated: —" };
  const diffMs = Math.max(0, Date.now() - d.getTime());
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

export function ControlLibraryClient() {
  const role = useRole();
  const canSubscribeControlHealth =
    role !== undefined && ROLE_SATISFIES[role].includes("AuditDirector");

  const [frameworkScope, setFrameworkScope] = useState<FrameworkId | "all">("all");
  const [statusScope, setStatusScope] = useState<Array<"pass" | "warn" | "fail" | "pending" | "auto">>([]);
  const [ownerScope, setOwnerScope] = useState<"all" | "unassigned" | string>("all");
  const [showAllOwnerFilters, setShowAllOwnerFilters] = useState(false);
  const [collapsedDomains, setCollapsedDomains] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

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

  const activated = libraryQ.data ?? [];
  const multiFramework = activated.length >= 2;

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

  const visibleOwners = showAllOwnerFilters
    ? owners
    : owners.slice(0, OWNER_FILTER_PREVIEW);
  const ownerFilterOverflow = owners.length - OWNER_FILTER_PREVIEW;

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

  const refsMatrix = useMemo(
    () => filteredItems.map((r) => r.frameworkRefs),
    [filteredItems]
  );

  const sharedCount =
    frameworkScope === "all"
      ? refsMatrix.filter((refs) => isControlSharedAcrossFrameworks(refs)).length
      : sharedControlsCountForFramework(frameworkScope, refsMatrix);

  const frameworkView = frameworkScope !== "all" ? frameworkScope : null;
  const frameworkProgress = useMemo(() => {
    if (!frameworkView) return null;
    const scoped = filteredItems;
    const counts = {
      pass: 0,
      warn: 0,
      fail: 0,
      pending: 0,
      auto: 0,
      total: 0,
    };
    for (const row of scoped) {
      const v = statusVariantFromApi(row.status);
      counts.total += 1;
      counts[v] += 1;
    }
    const passing = counts.pass;
    const pct = counts.total > 0 ? Math.round((passing / counts.total) * 100) : 0;
    return { ...counts, passing, pct };
  }, [filteredItems, frameworkView]);

  const qc = useQueryClient();

  useEffect(() => {
    if (!canSubscribeControlHealth) return;
    // SSE for live control health; endpoint requires AuditDirector (or OrgAdmin / PlatformSuperAdmin via ROLE_SATISFIES).
    const es = new EventSource("/api/v1/stream/control-health");
    const onUpdate = () => {
      qc.invalidateQueries({ queryKey: ["controls-list"] }).catch(() => {});
    };
    es.addEventListener("control.degraded", onUpdate);
    es.addEventListener("control.passed", onUpdate);
    es.addEventListener("message", onUpdate);
    return () => {
      es.removeEventListener("control.degraded", onUpdate);
      es.removeEventListener("control.passed", onUpdate);
      es.removeEventListener("message", onUpdate);
      es.close();
    };
  }, [qc, canSubscribeControlHealth]);

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
            aria-pressed={frameworkScope === "all"}
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
              aria-pressed={frameworkScope === f.id}
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
              aria-pressed={active}
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
          aria-pressed={ownerScope === "all"}
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
          aria-pressed={ownerScope === "unassigned"}
          onClick={() => setOwnerScope("unassigned")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            ownerScope === "unassigned"
              ? "bg-accent text-background"
              : "bg-card text-foreground-secondary hover:bg-surface-overlay border-border border"
          }`}
        >
          Unassigned
        </button>
        {visibleOwners.map((id) => (
          <button
            key={id}
            type="button"
            aria-label={ownerFilterAriaLabel(id)}
            aria-pressed={ownerScope === id}
            onClick={() => setOwnerScope(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              ownerScope === id
                ? "bg-accent text-background"
                : "bg-card text-foreground-secondary hover:bg-surface-overlay border-border border"
            }`}
            title={id}
          >
            {ownerBadgeFromId(id)}
          </button>
        ))}
        {ownerFilterOverflow > 0 && !showAllOwnerFilters ? (
          <button
            type="button"
            className="text-foreground-secondary hover:text-foreground border-border rounded-lg border bg-card px-3 py-1.5 text-sm"
            aria-label={`Show ${ownerFilterOverflow} more owners from this list`}
            onClick={() => setShowAllOwnerFilters(true)}
          >
            +{ownerFilterOverflow} more
          </button>
        ) : null}
        {owners.length > OWNER_FILTER_PREVIEW && showAllOwnerFilters ? (
          <button
            type="button"
            className="text-foreground-secondary hover:text-foreground text-sm underline"
            aria-label="Show fewer owner filters"
            onClick={() => setShowAllOwnerFilters(false)}
          >
            Show fewer
          </button>
        ) : null}

        {(frameworkScope !== "all" || statusScope.length > 0 || ownerScope !== "all") && (
          <button
            type="button"
            aria-label="Clear all filters"
            className="text-foreground-secondary hover:text-foreground ml-2 text-sm underline"
            onClick={() => {
              setFrameworkScope("all");
              setStatusScope([]);
              setOwnerScope("all");
              setShowAllOwnerFilters(false);
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

      {frameworkProgress && (
        <section className="border-border bg-card/60 mb-4 rounded-xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-foreground text-sm font-semibold">Framework progress</h2>
              <p className="text-foreground-secondary mt-1 text-xs">
                Passing controls / total controls
              </p>
            </div>
            <div className="text-foreground tabular-nums text-sm font-semibold" aria-label="Completion percentage">
              {frameworkProgress.pct}%
            </div>
          </div>

          <div className="bg-surface-overlay mt-3 h-2 w-full rounded-full" aria-label="Completion progress bar">
            <div
              className="bg-accent h-2 rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, frameworkProgress.pct))}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="text-foreground-secondary">
              <span className="text-foreground font-medium">Passing</span>: {frameworkProgress.pass}
            </div>
            <div className="text-foreground-secondary">
              <span className="text-foreground font-medium">Needs attention</span>:{" "}
              {frameworkProgress.warn}
            </div>
            <div className="text-foreground-secondary">
              <span className="text-foreground font-medium">Failing</span>: {frameworkProgress.fail}
            </div>
            <div className="text-foreground-secondary">
              <span className="text-foreground font-medium">Pending</span>:{" "}
              {frameworkProgress.pending}
            </div>
          </div>
        </section>
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
                      ? ownerSummaryForAria(row.assignedTo)
                      : "Unassigned";
                    const rowAriaLabel = `${row.name}. Status: ${statusLabel}. ${ownerLabel}. ${updated.label}. Open details.`;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          aria-label={rowAriaLabel}
                          onClick={() => {
                            openerRef.current = document.activeElement as HTMLElement | null;
                            setSelectedId(row.id);
                          }}
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
                                  aria-label={ownerSummaryForAria(row.assignedTo)}
                                  title={row.assignedTo}
                                >
                                  {ownerBadgeFromId(row.assignedTo)}
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
        <ControlSidePanel
          controlId={selectedId}
          openerRef={openerRef}
          onDismiss={() => setSelectedId(null)}
          showAssign
        />
      )}
    </div>
  );
}
