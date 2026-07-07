"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";
import { localDateISO } from "@/lib/utils";

export function useWeighIns() {
  return useQuery({
    queryKey: ["weigh_ins"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weigh_ins")
        .select("*")
        .order("logged_at", { ascending: false })
        .limit(90);
      if (error) throw error;
      return data;
    },
  });
}

export function useAddWeighIn() {
  const qc = useQueryClient();
  const session = useSession();
  return useMutation({
    mutationFn: async (input: { weight_kg: number; day?: string }) => {
      // Backdated entries land at local midday; the trigger recomputes the trend series.
      const backdated = input.day && input.day !== localDateISO();
      const { error } = await supabase.from("weigh_ins").insert({
        user_id: session!.user.id,
        weight_kg: input.weight_kg,
        ...(backdated ? { logged_at: new Date(`${input.day}T12:00:00`).toISOString() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weigh_ins"] });
      qc.invalidateQueries({ queryKey: ["weekly_balance"] });
    },
  });
}
