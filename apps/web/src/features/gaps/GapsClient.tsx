"use client";

import { FrameworkBadge, StatusChip } from "@grc/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ControlSidePanel } from "@/features/controls/ControlSidePanel";
import type { FrameworkId } from "@grc/types";

type GapItem = {
  controlId: string;
  name: string;
  domain: string;
  status: "warn" | "fail";
  frameworks: Array<{ key: FrameworkId; name: string }>;
  assignedTo: string | null;
  dueDate: string | null;
  updatedAt: string | null;
};

async function fetchGaps(): Promise<GapItem[]> {
  const res = await fetch("/api/v1/gaps", { credentials: "same-origin" });
  const body = (await res.json()) as {
    data?: { items: GapItem[] };
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(body.error?.message ?? "Could not load gaps");
  if (!body.data) throw new Error("Invalid response");
  return body.data.items;
}

function csvEscape(value: string) {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function GapsClient() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["gaps-list"],
    queryFn: fetchGaps,
    retry: false,
  });

  const items = q.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof EventSource !== "function") return;
    const es = new EventSource("/api/v1/stream/control-health");

    const onUpdate = () => {
      qc.invalidateQueries({ queryKey: ["gaps-list"] }).catch(() => {});
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
  }, [qc]);

  const csv = useMemo(() => {
    const header = ["frameworks", "domain", "controlName", "status", "owner", "dueDate", "lastUpdated"];
    const rows = items.map((it) => [
      it.frameworks.map((f) => f.key).join("|"),
      it.domain,
      it.name,
      it.status,
      it.assignedTo ?? "Unassigned",
      it.dueDate ?? "",
      it.updatedAt ?? "—",
    ]);
    return [header, ...rows].map((r) => r.map((c) => csvEscape(String(c))).join(",")).join("\n");
  }, [items]);

  const exportCsv = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gaps-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (q.isLoading) return <p className="text-foreground-secondary text-sm">Loading gaps…</p>;
  if (q.isError) {
    return (
      <p className="text-status-fail text-sm" role="alert">
        {(q.error as Error).message}
      </p>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Gaps</h1>
          <p className="text-foreground-secondary mt-2 max-w-2xl text-sm leading-relaxed">
            Amber and red controls that require remediation. Red items are listed first.
          </p>
        </div>
        <button
          type="button"
          className="bg-accent text-background rounded-lg px-3 py-2 text-sm font-medium"
          onClick={exportCsv}
          disabled={items.length === 0}
        >
          Export CSV
        </button>
      </div>

      <div className="border-border bg-card/60 mt-6 overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm" role="table">
          <thead className="border-border text-foreground-secondary border-b text-xs">
            <tr role="row">
              <th className="px-4 py-3" scope="col">
                Control
              </th>
              <th className="px-4 py-3" scope="col">
                Frameworks
              </th>
              <th className="px-4 py-3" scope="col">
                Domain
              </th>
              <th className="px-4 py-3" scope="col">
                Status
              </th>
              <th className="px-4 py-3" scope="col">
                Owner
              </th>
              <th className="px-4 py-3" scope="col">
                Last updated
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.controlId} role="row" className="border-border border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    className="text-foreground hover:text-foreground/90 underline-offset-4 hover:underline"
                    aria-label={`${it.name}. Open details.`}
                    onClick={() => {
                      openerRef.current = document.activeElement as HTMLElement | null;
                      setSelectedId(it.controlId);
                    }}
                  >
                    {it.name}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {it.frameworks.map((f) => (
                      <FrameworkBadge key={f.key} framework={f.key} size="sm" />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{it.domain}</td>
                <td className="px-4 py-3">
                  <StatusChip variant={it.status} size="sm" />
                </td>
                <td className="px-4 py-3">{it.assignedTo ?? "Unassigned"}</td>
                <td className="px-4 py-3 tabular-nums">{it.updatedAt ?? "—"}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr role="row">
                <td className="text-foreground-secondary px-4 py-6 text-sm" colSpan={6}>
                  No gaps right now.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
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

