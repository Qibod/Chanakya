"use client";

import { useQuery } from "@tanstack/react-query";

type ControlsPayload = {
  total: number;
  items: Array<{ id: string; name: string; domain: string; status: string }>;
  nextCursor: string | null;
};

async function fetchControls(): Promise<{ data: ControlsPayload }> {
  const res = await fetch("/api/v1/controls?limit=500", { credentials: "same-origin" });
  const body = (await res.json()) as { data?: ControlsPayload; error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message ?? "Could not load controls");
  if (!body.data) throw new Error("Invalid response");
  return { data: body.data };
}

export function DashboardControlsSummary() {
  const q = useQuery({
    queryKey: ["controls-list"],
    queryFn: async () => {
      const r = await fetchControls();
      return r.data;
    },
  });

  return (
    <div className="mt-8 space-y-4">
      <div>
        <h2 className="text-foreground text-lg font-medium">Control library</h2>
        {q.isLoading && <p className="text-foreground-secondary mt-2 text-sm">Loading controls…</p>}
        {q.isError && (
          <p className="text-status-fail mt-2 text-sm">{(q.error as Error).message}</p>
        )}
        {q.data && (
          <p className="text-foreground-secondary mt-2 text-sm">
            <span className="text-foreground font-semibold">{q.data.total}</span> unified controls
            in your library
            {q.data.total > 0 ? ` (example: ${q.data.items[0]?.name ?? "—"})` : ""}.
          </p>
        )}
      </div>
    </div>
  );
}
