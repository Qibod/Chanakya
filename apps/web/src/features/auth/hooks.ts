"use client";

import { useQuery } from "@tanstack/react-query";
import type { UserRole } from "@grc/types";
import { meQueryKey, fetchMe, type MeResponse } from "./queries";

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: meQueryKey,
    queryFn: fetchMe,
  });
}

export function useRole(): UserRole | undefined {
  const { data } = useMe();
  return data?.role;
}
