"use client";

import { useEffect, useState } from "react";

/** Shows cross-framework overlap % after Story 2.4 activation (sessionStorage bridge). */
export function IntegrationsOverlapBanner() {
  const [pct, setPct] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("grc_onboarding_overlap_percent");
      setPct(raw && raw !== "" ? raw : null);
    } catch {
      setPct(null);
    }
  }, []);

  if (pct == null) return null;

  return (
    <p className="border-border bg-card text-foreground-secondary rounded-lg border px-4 py-3 text-sm">
      <span className="text-foreground font-medium">{pct}%</span> of your controls are shared
      across your active frameworks.
    </p>
  );
}
