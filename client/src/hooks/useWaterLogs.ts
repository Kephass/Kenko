"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { WATER_MUTATION_KEY, type WaterWrite } from "@/lib/waterMutations";
import type { Tables } from "@/lib/types";
import { dayRange, localDateISO } from "@/lib/utils";

export function waterTotal(logs: { amount_ml: number }[] | undefined) {
  return (logs ?? []).reduce((sum, w) => sum + Number(w.amount_ml), 0);
}

export function useWaterForDay(day: string) {
  return useQuery({
    queryKey: ["water_logs", "day", day],
    staleTime: 60_000,
    queryFn: async () => {
      const range = dayRange(day);
      const rows: Tables<"water_logs">[] = [];
      // Fetch every entry before calculating the day's total, with stable ties.
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase
          .from("water_logs")
          .select("*")
          .gte("logged_at", range.start)
          .lt("logged_at", range.end)
          .order("logged_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) return rows;
      }
    },
  });
}

export function useTodayWater() {
  return useWaterForDay(localDateISO());
}

export function useWriteWater() {
  return useMutation<void, Error, WaterWrite>({ mutationKey: WATER_MUTATION_KEY });
}
