import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const frameworkBadgeVariants = cva(
  "inline-flex items-center rounded font-medium uppercase tracking-wide",
  {
    variants: {
      framework: {
        SOC2: "bg-indigo-950 text-indigo-300 ring-1 ring-indigo-700/50",
        ISO27001: "bg-blue-950 text-blue-300 ring-1 ring-blue-700/50",
        GDPR: "bg-violet-950 text-violet-300 ring-1 ring-violet-700/50",
        NIST_CSF: "bg-teal-950 text-teal-300 ring-1 ring-teal-700/50",
        SOX: "bg-amber-950 text-amber-300 ring-1 ring-amber-700/50",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[10px]",
        md: "px-2 py-0.5 text-[11px]",
        lg: "px-2.5 py-1 text-[12px]",
      },
    },
    defaultVariants: { size: "md" },
  }
);

const FRAMEWORK_LABELS: Record<string, string> = {
  SOC2: "SOC 2",
  ISO27001: "ISO 27001",
  GDPR: "GDPR",
  NIST_CSF: "NIST CSF",
  SOX: "SOX",
};

export interface FrameworkBadgeProps
  extends VariantProps<typeof frameworkBadgeVariants> {
  className?: string;
}

export function FrameworkBadge({
  framework,
  size = "md",
  className,
}: FrameworkBadgeProps) {
  const label = framework
    ? (FRAMEWORK_LABELS[framework] ?? String(framework))
    : "Unknown";
  return (
    <span
      className={clsx(frameworkBadgeVariants({ framework, size }), className)}
      aria-label={`Framework: ${label}`}
    >
      {label}
    </span>
  );
}
