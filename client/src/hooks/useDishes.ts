"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";

export function useDishes() {
  return useQuery({
    queryKey: ["dishes"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("dishes").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export type DishInput = {
  name: string;
  calories_per_100g: number;
  protein_g_per_100g?: number;
  carbs_g_per_100g?: number;
  fat_g_per_100g?: number;
  fiber_g_per_100g?: number;
  reference_serving_g?: number;
};

export function useAddDish() {
  const qc = useQueryClient();
  const session = useSession();
  return useMutation({
    mutationFn: async (dish: DishInput) => {
      const { error } = await supabase
        .from("dishes")
        .insert({ user_id: session!.user.id, ...dish });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dishes"] }),
  });
}

export function useUpdateDish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; edits: Partial<DishInput> }) => {
      const { error } = await supabase.from("dishes").update(input.edits).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dishes"] }),
  });
}

export function useDeleteDish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dishes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dishes"] });
      qc.invalidateQueries({ queryKey: ["meal_logs"] });
    },
  });
}
