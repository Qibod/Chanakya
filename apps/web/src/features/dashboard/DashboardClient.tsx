"use client";

import { StatusChip } from "@grc/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ControlSidePanel } from "@/features/controls/ControlSidePanel";

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
              onClick={() => onFixNow(topIssue.controlId)}
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
  const expanded = open;

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
                onClick={() => item.controlId && onFixNow(item.controlId)}
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
  const openerRef = useRef<HTMLElement | null>(null);

  const fixedDomains = useMemo(() => {
    const domains = model?.domains ?? [];
    const picked = domains.slice(0, 8);
    if (picked.length === 8) return picked;
    const placeholders: DashboardDomainCard[] = Array.from({ length: 8 - picked.length }).map(
      (_v, idx) => ({
        domain: `No data ${idx + 1}`,
        status: "pending",
        passRatePct: 0,
        controlCount: 0,
        topIssue: null,
        sparkline30d: Array.from({ length: 30 }).map(() => 0),
      })
    );
    return [...picked, ...placeholders];
  }, [model]);

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
        <ControlSidePanel
          controlId={selectedId}
          openerRef={openerRef}
          onDismiss={() => setSelectedId(null)}
          showAssign
        />
      ) : null}
    </div>
  );
}

