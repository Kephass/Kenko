import type { QueryClient } from "@tanstack/react-query";
import type { Tables } from "./types";
import { supabase } from "./supabase";
import { finiteNumber, logTimestamp, type MealType } from "./tracking";
import { smartFoodPoints } from "./points";
import { localDateISO } from "./utils";

type Meal = Tables<"meal_logs">;
export type MealCopy = { user_id: string; rows: Meal[] };
export const COPY_MEAL_KEY = ["meal_logs", "copy"] as const;
export function makeMealCopy(rows: Meal[], userId: string, when: string, mealType: MealType, newId = () => crypto.randomUUID()): MealCopy {
  const logged_at = logTimestamp(when);
  return { user_id: userId, rows: rows.map(row => {
    if (row.user_id !== userId || !row.confirmed) throw new Error("Only your confirmed foods can be copied.");
    return { ...row, id: newId(), logged_at, created_at: new Date().toISOString(), meal_type: mealType, photo_url: null, match_confidence: null, dishware_id: null, source: "manual", confirmed: true };
  }) };
}
function validateCopy(input: MealCopy) {
  if (!input.rows.length || input.rows.length > 100) throw new Error("Choose between 1 and 100 foods to copy.");
  if (new Set(input.rows.map(row => row.id)).size !== input.rows.length) throw new Error("Copied foods need distinct identifiers.");
  const day = localDateISO(new Date(input.rows[0].logged_at));
  for (const row of input.rows) {
    if (row.user_id !== input.user_id) throw new Error("Copied foods must belong to the same account.");
    if (!Number.isFinite(new Date(row.logged_at).getTime()) || localDateISO(new Date(row.logged_at)) !== day) throw new Error("Copied foods must share a valid diary day.");
    finiteNumber(row.calories, "Calories");
    for (const value of [row.protein_g, row.carbs_g, row.fat_g, row.fiber_g]) if (value != null) finiteNumber(value, "Nutrients");
  }
  return day;
}
export function registerMealCopyDefaults(qc: QueryClient) {
  qc.setMutationDefaults(COPY_MEAL_KEY, {
    scope: { id: "meal-writes" },
    mutationFn: async (input: MealCopy) => {
      validateCopy(input);
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id !== input.user_id) throw new Error("Sign in to the account that copied this meal to sync it.");
      const rows = input.rows.map(row => ({ id: row.id, user_id: input.user_id, logged_at: row.logged_at, meal_type: row.meal_type, raw_text_input: row.raw_text_input, dish_id: row.dish_id, portion_ratio: row.portion_ratio, calories: row.calories, protein_g: row.protein_g, carbs_g: row.carbs_g, fat_g: row.fat_g, fiber_g: row.fiber_g, points: row.points ?? smartFoodPoints(row), source: "manual", confirmed: true }));
      const { error } = await supabase.from("meal_logs").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onMutate: async (input: MealCopy) => {
      const day = validateCopy(input);
      const key = ["meal_logs", "day", day];
      await qc.cancelQueries({ queryKey: key });
      const ids = new Set(input.rows.map(row => row.id));
      qc.setQueryData<Meal[]>(key, (old = []) => [...input.rows, ...old.filter(row => !ids.has(row.id))].sort((a, b) => b.logged_at.localeCompare(a.logged_at)));
      return { key };
    },
    onError: (_error, input, context) => {
      if (!context) return;
      const ids = new Set(input.rows.map(row => row.id));
      qc.setQueryData<Meal[]>(context.key, (old = []) => old.filter(row => !ids.has(row.id)));
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ["meal_logs"] }) > 1) return;
      qc.invalidateQueries({ queryKey: ["meal_logs"] });
      qc.invalidateQueries({ queryKey: ["daily_summary"] });
      qc.invalidateQueries({ queryKey: ["weekly_balance"] });
    },
  });
}
