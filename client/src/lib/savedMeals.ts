import type { QueryClient } from "@tanstack/react-query";
import type { Tables } from "./types";
import { supabase } from "./supabase";
import { finiteNumber, MEAL_TYPES, repeatNutrition, nutritionInput, type MealType } from "./tracking";
import { makeMealCopy } from "./copyMeal";
import { smartFoodPoints } from "./points";
export type SavedFood = { name: string; calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null };
export type SavedMeal = Tables<"saved_meals">;
export type SavedMealWrite = { operation: "add" | "update" | "delete"; row: SavedMeal };
export const SAVED_MEAL_KEY = ["saved_meals", "write"] as const;
export function parseSavedFoods(value: unknown): SavedFood[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new Error("A saved meal needs between 1 and 100 foods.");
  return value.map(item => {
    if (!item || typeof item !== "object" || typeof item.name !== "string" || !item.name.trim() || item.name.length > 500 || typeof item.calories !== "number") throw new Error("Saved food details are invalid.");
    const optional = (key: string) => {
      if (item[key] === null) return null;
      if (typeof item[key] !== "number") throw new Error("Saved nutrients are invalid.");
      return finiteNumber(item[key], "Nutrition");
    };
    return { name: item.name.trim(), calories: finiteNumber(item.calories, "Calories"), protein_g: optional("protein_g"), carbs_g: optional("carbs_g"), fat_g: optional("fat_g"), fiber_g: optional("fiber_g") };
  });
}
export function saveMealSnapshot(rows: Tables<"meal_logs">[], userId: string, name: string, type: MealType): SavedMeal {
  const foods = rows.map(row => {
    if (row.user_id !== userId || !row.confirmed) throw new Error("Only your confirmed foods can be saved.");
    return { name: row.raw_text_input || "Food", calories: Number(row.calories), protein_g: row.protein_g ?? null, carbs_g: row.carbs_g ?? null, fat_g: row.fat_g ?? null, fiber_g: row.fiber_g ?? null };
  });
  return validateSavedMeal({ id: crypto.randomUUID(), user_id: userId, name, meal_type: type, foods, created_at: new Date().toISOString() });
}
function validateSavedMeal(row: SavedMeal): SavedMeal {
  if (!row.name.trim() || row.name.trim().length > 120) throw new Error("Choose a meal name between 1 and 120 characters.");
  if (!MEAL_TYPES.includes(row.meal_type as MealType)) throw new Error("Choose a valid meal category.");
  return { ...row, name: row.name.trim(), foods: parseSavedFoods(row.foods) };
}
export function savedMealPreview(value: unknown, multiplier: string) {
  const factor = finiteNumber(multiplier, "Saved portions", true);
  const foods = parseSavedFoods(value).map(food => ({
    ...food, ...nutritionInput(repeatNutrition(food, multiplier)),
    name: factor === 1 ? food.name : `${factor}× saved amount · ${food.name}`,
  }));
  const nutrients = (["protein_g", "carbs_g", "fat_g", "fiber_g"] as const).map(key => ({
    key, total: finiteNumber(foods.reduce((sum, food) => sum + (food[key] ?? 0), 0), "Total nutrients"),
    missing: foods.filter(food => food[key] === null).length,
  }));
  return { foods, nutrients, calories: finiteNumber(foods.reduce((sum, food) => sum + food.calories, 0), "Total calories") };
}
export function logSavedMeal(row: SavedMeal, userId: string, multiplier: string, when: string, type: MealType) {
  if (row.user_id !== userId) throw new Error("This saved meal belongs to another account.");
  const rows: Tables<"meal_logs">[] = savedMealPreview(row.foods, multiplier).foods.map((food, index) => ({
    id: String(index), user_id: userId, raw_text_input: food.name, calories: food.calories, protein_g: food.protein_g, carbs_g: food.carbs_g, fat_g: food.fat_g, fiber_g: food.fiber_g, points: smartFoodPoints(food),
    created_at: row.created_at, logged_at: row.created_at, meal_type: type, confirmed: true, source: "manual",
    dish_id: null, dishware_id: null, portion_ratio: null, photo_url: null, match_confidence: null,
  }));
  return makeMealCopy(rows, userId, when, type);
}
export function registerSavedMealDefaults(qc: QueryClient) {
  qc.setMutationDefaults(SAVED_MEAL_KEY, {
    scope: { id: "meal-writes" },
    mutationFn: async ({ operation, row }: SavedMealWrite) => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id !== row.user_id) throw new Error("Sign in to the account that saved this meal to sync it.");
      const clean = operation === "delete" ? row : validateSavedMeal(row);
      const result = operation === "delete" ? await supabase.from("saved_meals").delete().eq("id", row.id).eq("user_id", row.user_id)
        : operation === "update" ? await supabase.from("saved_meals").update({ name: clean.name, foods: clean.foods, meal_type: clean.meal_type }).eq("id", row.id).eq("user_id", row.user_id).select("id").single()
        : await supabase.from("saved_meals").upsert({ id: clean.id, user_id: clean.user_id, name: clean.name, foods: clean.foods, meal_type: clean.meal_type, created_at: clean.created_at }, { onConflict: "id", ignoreDuplicates: true });
      if (result.error) throw result.error;
    },
    onMutate: async ({ operation, row }: SavedMealWrite) => {
      const clean = operation === "delete" ? row : validateSavedMeal(row);
      await qc.cancelQueries({ queryKey: ["saved_meals"] });
      const previous = qc.getQueryData<SavedMeal[]>(["saved_meals"])?.find(item => item.id === row.id);
      qc.setQueryData<SavedMeal[]>(["saved_meals"], (old = []) => {
        const rest = old.filter(item => item.id !== row.id);
        return (operation === "delete" ? rest : [...rest, clean]).sort((a,b) => a.name.localeCompare(b.name));
      });
      return { previous };
    },
    onError: (_error, { row }, context) => {
      if (!context) return;
      qc.setQueryData<SavedMeal[]>(["saved_meals"], (old = []) => {
        const rest = old.filter(item => item.id !== row.id);
        return context.previous ? [...rest, context.previous].sort((a,b) => a.name.localeCompare(b.name)) : rest;
      });
    },
    onSettled: () => { if (qc.isMutating({ mutationKey: ["saved_meals"] }) === 1) qc.invalidateQueries({ queryKey: ["saved_meals"] }); },
  });
}
