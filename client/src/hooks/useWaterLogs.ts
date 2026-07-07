"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";
import { todayStart } from "@/lib/utils";

export function waterTotal(logs: { amount_ml: number }[] | undefined) {
  return (logs ?? []).reduce((sum, w) => sum + Number(w.amount_ml), 0);
}

export function useTodayWater() {
  return useQuery({
    queryKey: ["water_logs", "today"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("water_logs")
        .select("*")
        .gte("logged_at", todayStart())
        .order("logged_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddWater() {
  const qc = useQueryClient();
  const session = useSession();
  return useMutation({
    mutationFn: async (amount_ml: number) => {
      const { error } = await supabase
        .from("water_logs")
        .insert({ user_id: session!.user.id, amount_ml });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water_logs"] }),
  });
}
