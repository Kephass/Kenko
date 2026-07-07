"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";

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
    mutationFn: async (weight_kg: number) => {
      const { error } = await supabase
        .from("weigh_ins")
        .insert({ user_id: session!.user.id, weight_kg });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weigh_ins"] });
      qc.invalidateQueries({ queryKey: ["weekly_balance"] });
    },
  });
}
