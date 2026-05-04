import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const confidenceChipVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-mono font-medium tabular-nums",
  {
    variants: {
      variant: {
        high: "bg-indigo-950 text-indigo-300",
        medium: "bg-amber-950 text-amber-300",
        low: "bg-zinc-800 text-zinc-400",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-0.5 text-[11px]",
        lg: "px-3 py-1 text-[12px]",
      },
    },
    defaultVariants: { variant: "medium", size: "md" },
  }
);

function computeVariant(value: number): "high" | "medium" | "low" {
  if (value >= 80) return "high";
  if (value >= 50) return "medium";
  return "low";
}

export interface ConfidenceChipProps
  extends VariantProps<typeof confidenceChipVariants> {
  value: number;
  className?: string;
}

export function ConfidenceChip({
  value,
  variant,
  size = "md",
  className,
}: ConfidenceChipProps) {
  const resolvedVariant = variant ?? computeVariant(value);
  return (
    <span
      aria-label={`AI confidence: ${value}%`}
      className={clsx(
        confidenceChipVariants({ variant: resolvedVariant, size }),
        className
      )}
    >
      {value}%
    </span>
  );
}
