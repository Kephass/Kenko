"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";

export type DailySummary = {
  day: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  meal_count: number;
};

/** Per-day rollup of confirmed meal logs, bucketed in the local timezone. */
export function useDailySummary(start: string, end: string) {
  const session = useSession();
  return useQuery({
    queryKey: ["daily_summary", start, end],
    enabled: !!session,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("daily_nutrition_summary", {
        p_user_id: session!.user.id,
        p_start: start,
        p_end: end,
        p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (error) throw error;
      return data as DailySummary[];
    },
  });
}

export function summaryByDay(rows: DailySummary[] | undefined) {
  return Object.fromEntries((rows ?? []).map((r) => [r.day, r]));
}
