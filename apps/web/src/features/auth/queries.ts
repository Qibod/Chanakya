import type { UserRole } from "@grc/types";

export interface MeResponse {
  userId: string;
  orgId: string;
  role: UserRole;
  tier: string;
}

export const meQueryKey = ["me"] as const;

export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch("/api/v1/me");
  if (!res.ok) throw new Error(`Failed to fetch identity (${res.status})`);
  return res.json() as Promise<MeResponse>;
}
