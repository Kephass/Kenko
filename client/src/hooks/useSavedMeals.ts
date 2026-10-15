"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";
import { SAVED_MEAL_KEY, type SavedMeal, type SavedMealWrite } from "@/lib/savedMeals";
export function useSavedMeals() {
  const session = useSession();
  return useQuery({ queryKey: ["saved_meals"], enabled: !!session, queryFn: async () => {
    const rows: SavedMeal[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("saved_meals").select("*").eq("user_id", session!.user.id).order("name").order("id").range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  } });
}
export function useWriteSavedMeal() { return useMutation<void, Error, SavedMealWrite>({ mutationKey: SAVED_MEAL_KEY }); }
