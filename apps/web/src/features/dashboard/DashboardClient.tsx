"use client";

import { StatusChip } from "@grc/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

export type DashboardDomainCard = {
  domain: string;
  status: "pass" | "warn" | "fail" | "pending";
  passRatePct: number;
  controlCount: number;
  topIssue: null | { controlId: string; controlName: string; status: "warn" | "fail" };
  sparkline30d: number[];
};

export type DashboardFeedItem = {
  id: string;
  severity: "fail" | "warn" | "info" | "pass";
  title: string;
  meta: string;
  controlId: string | null;
};

export type DashboardReadModel = {
  summary: {
    passing: number;
    attention: number;
    failing: number;
    passingDeltaWeek: number;
    trajectoryScore: number | null;
  };
  domains: DashboardDomainCard[];
  feed: DashboardFeedItem[];
};

async function fetchDashboard(): Promise<{ data: DashboardReadModel }> {
  const res = await fetch("/api/v1/dashboard", { credentials: "same-origin" });
  const body = (await res.json()) as {
    data?: DashboardReadModel;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(body.error?.message ?? "Could not load dashboard");
  if (!body.data) throw new Error("Invalid response");
  return { data: body.data };
}

type ControlDetail = {
  id: string;
  name: string;
  domain: string;
  status: string;
  frameworkRefs: string[];
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

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function statusFromCounts({
  failing,
  attention,
}: {
  failing: number;
  attention: number;
}): "pass" | "warn" | "fail" | "pending" {
  if (failing > 0) return "fail";
  if (attention > 0) return "warn";
  return "pass";
}

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="border-border bg-card/60 rounded-lg border p-4">
      <div className="text-foreground-secondary text-xs font-medium">{label}</div>
      <div className="text-foreground mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {detail ? <div className="text-foreground-secondary mt-1 text-xs">{detail}</div> : null}
    </div>
  );
}

function ControlDomainCard({
  card,
  onFixNow,
}: {
  card: DashboardDomainCard;
  onFixNow: (controlId: string) => void;
}) {
  const pct = clampPct(card.passRatePct);
  const topIssue = card.topIssue;

  return (
    <div className="border-border bg-card/60 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-foreground truncate text-sm font-semibold">{card.domain}</div>
          <div className="text-foreground-secondary mt-1 text-xs">
            {card.controlCount} controls · {pct}% passing
          </div>
        </div>
        <StatusChip variant={card.status} size="sm" />
      </div>

      <div className="text-foreground-secondary mt-4 text-xs" aria-label="30-day history">
        {/* Sparkline ships with server-side precompute; this is a placeholder rendering. */}
        30d trend: {card.sparkline30d.length ? `${card.sparkline30d[card.sparkline30d.length - 1]}%` : "—"}
      </div>

      {topIssue ? (
        <div className="mt-4 rounded-md border border-status-fail/20 bg-status-fail/5 p-3">
          <div className="text-foreground text-xs font-semibold">
            {topIssue.status === "fail" ? "Failing" : "Needs attention"}:{" "}
            <span className="font-medium">{topIssue.controlName}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="bg-accent text-background rounded-md px-3 py-1.5 text-xs font-medium"
              onClick={() => onFixNow(topIssue.controlId)}
            >
              Fix now
            </button>
            <button
              type="button"
              className="border-border text-foreground rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              Assign
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FeedItem({
  item,
  onFixNow,
}: {
  item: DashboardFeedItem;
  onFixNow: (controlId: string) => void;
}) {
  const [open, setOpen] = useState(item.severity === "fail");
  const expanded = open || item.severity === "fail";

  return (
    <div className="border-border bg-card/60 rounded-lg border p-3">
      <button
        type="button"
        className="w-full text-left"
        aria-expanded={expanded}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-foreground text-sm font-medium">{item.title}</div>
          <span className="text-foreground-secondary text-xs">{item.severity.toUpperCase()}</span>
        </div>
        <div className="text-foreground-secondary mt-1 text-xs">{item.meta}</div>
      </button>

      {expanded ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.severity === "fail" || item.severity === "warn" ? (
            <>
              <button
                type="button"
                className="bg-accent text-background rounded-md px-3 py-1.5 text-xs font-medium"
                disabled={!item.controlId}
                onClick={() => item.controlId && onFixNow(item.controlId)}
              >
                Fix now
              </button>
              <button
                type="button"
                className="border-border text-foreground rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Assign
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DashboardClient({
  onFixNow,
}: {
  onFixNow?: (controlId: string) => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["dashboard-read-model"],
    queryFn: async () => (await fetchDashboard()).data,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const model = q.data;
  const esRef = useRef<EventSource | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelReducedMotion, setPanelReducedMotion] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setPanelReducedMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const detailQ = useQuery({
    queryKey: ["control-detail", selectedId],
    queryFn: () => fetchControlDetail(selectedId!),
    enabled: selectedId != null,
  });
  const fixedDomains = useMemo(() => {
    const domains = model?.domains ?? [];
    const picked = domains.slice(0, 8);
    if (picked.length === 8) return picked;
    const placeholders: DashboardDomainCard[] = Array.from({ length: 8 - picked.length }).map(
      (_v, idx) => ({
        domain: `Domain ${picked.length + idx + 1}`,
        status: "pending",
        passRatePct: 0,
        controlCount: 0,
        topIssue: null,
        sparkline30d: [],
      })
    );
    return [...picked, ...placeholders];
  }, [model]);

  const closePanel = () => {
    if (panelReducedMotion) {
      setSelectedId(null);
      return;
    }
    setPanelOpen(false);
  };

  useEffect(() => {
    if (!selectedId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
      const root = panelRef.current;
      if (!root) return;
      if (e.key !== "Tab") return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    if (panelReducedMotion) {
      setPanelOpen(true);
    } else {
      setPanelOpen(false);
      requestAnimationFrame(() => setPanelOpen(true));
    }
    requestAnimationFrame(() => closeBtnRef.current?.focus?.());

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panelReducedMotion, selectedId]);

  useEffect(() => {
    if (!selectedId || panelReducedMotion) return;
    if (panelOpen) return;
    // When slide-out completes, clear selected id and restore focus.
    const t = setTimeout(() => {
      setSelectedId(null);
      openerRef.current?.focus?.();
      openerRef.current = null;
    }, 220);
    return () => clearTimeout(t);
  }, [panelOpen, panelReducedMotion, selectedId]);

  const handleFixNow = (controlId: string) => {
    onFixNow?.(controlId);
    openerRef.current = document.activeElement as HTMLElement | null;
    setSelectedId(controlId);
  };

  useEffect(() => {
    // SSE for live control health events; server enforces RBAC/tenant scoping.
    const es = new EventSource("/api/v1/stream/control-health");
    esRef.current = es;

    const onUpdate = () => {
      // Keep it simple: invalidate dashboard read model and let React Query refetch.
      qc.invalidateQueries({ queryKey: ["dashboard-read-model"] }).catch(() => {});
    };

    es.addEventListener("control.degraded", onUpdate);
    es.addEventListener("control.passed", onUpdate);
    es.addEventListener("message", onUpdate);

    return () => {
      es.removeEventListener("control.degraded", onUpdate);
      es.removeEventListener("control.passed", onUpdate);
      es.removeEventListener("message", onUpdate);
      es.close();
      esRef.current = null;
    };
  }, [qc]);

  if (q.isLoading) {
    return <p className="text-foreground-secondary mt-4 text-sm">Loading dashboard…</p>;
  }
  if (q.isError) {
    return (
      <p className="text-status-fail mt-4 text-sm" role="alert">
        {(q.error as Error).message}
      </p>
    );
  }
  if (!model) {
    return (
      <p className="text-status-fail mt-4 text-sm" role="alert">
        Dashboard unavailable
      </p>
    );
  }

  const overallStatus = statusFromCounts({
    failing: model.summary.failing,
    attention: model.summary.attention,
  });

  return (
    <div className="mt-6">
      <div aria-live="polite" aria-atomic="false">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric
            label="Passing"
            value={`${model.summary.passing}`}
            detail={`Weekly Δ ${model.summary.passingDeltaWeek >= 0 ? "+" : ""}${model.summary.passingDeltaWeek}`}
          />
          <SummaryMetric label="Needs attention" value={`${model.summary.attention}`} />
          <SummaryMetric label="Failing" value={`${model.summary.failing}`} />
          <SummaryMetric
            label="Trajectory"
            value={model.summary.trajectoryScore == null ? "—" : `${model.summary.trajectoryScore}`}
            detail="Placeholder"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-foreground text-sm font-semibold">Control domains</h2>
            <StatusChip variant={overallStatus} size="sm" />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {fixedDomains.map((card) => (
              <ControlDomainCard key={card.domain} card={card} onFixNow={handleFixNow} />
            ))}
          </div>
        </div>

        <aside className="xl:sticky xl:top-4">
          <h2 className="text-foreground text-sm font-semibold">Action feed</h2>
          <div className="mt-3 space-y-3">
            {model.feed.map((item) => (
              <FeedItem key={item.id} item={item} onFixNow={handleFixNow} />
            ))}
          </div>
        </aside>
      </div>

      {selectedId ? (
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
            aria-labelledby="dashboard-control-panel-title"
          >
            <div className="border-border flex items-start justify-between border-b px-4 py-3">
              <h2 id="dashboard-control-panel-title" className="text-foreground pr-2 text-lg font-semibold">
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
              {detailQ.isLoading ? (
                <p className="text-foreground-secondary text-sm">Loading details…</p>
              ) : null}
              {detailQ.isError ? (
                <p className="text-status-fail text-sm" role="alert">
                  {(detailQ.error as Error).message}
                </p>
              ) : null}
              {detailQ.data ? (
                <>
                  <p className="text-foreground-secondary text-sm">{detailQ.data.domain}</p>
                  <p className="text-foreground-secondary mt-1 text-xs">Status: {detailQ.data.status}</p>
                  <p className="text-foreground-secondary mt-6 text-sm leading-relaxed">
                    Full remediation and assignment flows ship in upcoming stories. This panel is here to keep
                    the dashboard “no navigation” promise.
                  </p>
                </>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

