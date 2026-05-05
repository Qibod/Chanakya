export type ControlStatusVariant = "pass" | "warn" | "fail" | "pending" | "auto";

export function statusVariantFromApi(status: string): ControlStatusVariant {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "pass" || normalized === "passing") return "pass";
  if (normalized === "warn" || normalized === "warning" || normalized === "attention") return "warn";
  if (normalized === "fail" || normalized === "failing") return "fail";
  if (normalized === "auto" || normalized === "auto-monitored") return "auto";
  return "pending";
}

