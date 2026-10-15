"use client";

import { useMutation, useQuery, type MutateOptions } from "@tanstack/react-query";
import { DISH_WRITE_KEY, type DishInput, type DishWrite } from "@/lib/dishMutations";
export type { DishInput } from "@/lib/dishMutations";
import type { Tables } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";

export function useDishes() {
  return useQuery({
    queryKey: ["dishes"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const rows: Tables<"dishes">[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("dishes").select("*").order("name").order("id").range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) return rows;
      }
    },
  });
}


function useDishWrite<T>(operation: DishWrite["operation"], unpack: (value: T) => { id: string; edits: Partial<DishInput> }) {
  const session = useSession();
  const mutation = useMutation<void, Error, DishWrite>({ mutationKey: DISH_WRITE_KEY });
  return { ...mutation, mutate: (value: T, options?: MutateOptions<void, Error, DishWrite>) => {
    mutation.mutate({ operation, user_id: session?.user.id ?? "", created_at: new Date().toISOString(), ...unpack(value) }, options);
  } };
}
export function useAddDish() {
  return useDishWrite("add", (edits: DishInput) => ({ id: crypto.randomUUID(), edits }));
}
export function useUpdateDish() {
  return useDishWrite("update", (input: { id: string; edits: Partial<DishInput> }) => input);
}
export function useDeleteDish() {
  return useDishWrite("delete", (id: string) => ({ id, edits: {} }));
}
