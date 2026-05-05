"use client";

import { useEffect, useState } from "react";

const COVERAGE_NOTICE_STORAGE_KEY = "grc_framework_activation_coverage_notice";

type CoverageNotice = { count: number; label: string; createdAt?: string };

/** Non-blocking notice shown after incremental activation (Story 2.6). */
export function FrameworkCoverageNoticeBanner() {
  const [notice, setNotice] = useState<CoverageNotice | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(COVERAGE_NOTICE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CoverageNotice;
      if (typeof parsed?.count === "number" && typeof parsed?.label === "string") {
        setNotice(parsed);
      }
      sessionStorage.removeItem(COVERAGE_NOTICE_STORAGE_KEY);
    } catch {
      setNotice(null);
    }
  }, []);

  if (!notice || notice.count <= 0) return null;

  return (
    <div
      className="border-border bg-card rounded-lg border px-4 py-3 text-sm shadow-sm"
      role="status"
      aria-live="polite"
    >
      <p className="text-foreground-secondary">
        <span className="text-foreground font-medium">{notice.count}</span> controls from{" "}
        <span className="text-foreground font-medium">{notice.label}</span> are already covered by
        your existing controls.
      </p>
      <button
        type="button"
        className="text-accent mt-2 text-xs font-medium underline"
        onClick={() => setNotice(null)}
      >
        Dismiss
      </button>
    </div>
  );
}

