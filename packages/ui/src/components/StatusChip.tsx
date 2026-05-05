"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const statusChipVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-medium",
  {
    variants: {
      variant: {
        pass: "bg-[var(--status-pass-bg)] text-[var(--status-pass)]",
        warn: "bg-[var(--status-warn-bg)] text-[var(--status-warn)]",
        fail: "bg-[var(--status-fail-bg)] text-[var(--status-fail)]",
        auto: "bg-[var(--status-auto-bg)] text-[var(--status-auto)]",
        pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending)]",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-0.5 text-[12px]",
        lg: "px-3 py-1 text-[13px]",
      },
    },
    defaultVariants: { variant: "pending", size: "md" },
  }
);

const LABELS: Record<
  NonNullable<VariantProps<typeof statusChipVariants>["variant"]>,
  string
> = {
  pass: "Passing",
  warn: "Needs attention",
  fail: "Failing",
  auto: "Auto-monitored",
  pending: "Pending",
};

const ICON_PATHS: Record<string, string> = {
  pass: "M5 13l4 4L19 7",
  warn: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01",
  fail: "M6 18L18 6M6 6l12 12",
  auto: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  pending:
    "M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z",
};

export interface StatusChipProps
  extends VariantProps<typeof statusChipVariants> {
  compact?: boolean;
  className?: string;
}

export function StatusChip({
  variant = "pending",
  size = "md",
  compact = false,
  className,
}: StatusChipProps) {
  const resolvedVariant = variant ?? "pending";
  const label = LABELS[resolvedVariant];
  const iconPath = ICON_PATHS[resolvedVariant];
  const svgSize = size === "sm" ? 10 : size === "lg" ? 14 : 12;

  return (
    <span
      role="status"
      aria-label={`Control status: ${label}`}
      title={compact ? label : undefined}
      className={clsx(statusChipVariants({ variant, size }), className)}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={iconPath} />
      </svg>
      {!compact && <span>{label}</span>}
    </span>
  );
}
