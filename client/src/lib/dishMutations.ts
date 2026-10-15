import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Tables } from "./types";
import { parseRecipeDetails, type RecipeDetails } from "./recipe";
import { finiteNumber } from "./tracking";

export type DishInput = {
  recipe_details?: RecipeDetails | null;
  notes?: string | null;
  name: string; calories_per_100g: number; is_favorite?: boolean;
  protein_g_per_100g?: number | null; carbs_g_per_100g?: number | null; fat_g_per_100g?: number | null; fiber_g_per_100g?: number | null;
  reference_serving_g?: number | null;
};
export type DishWrite = { operation: "add" | "update" | "delete"; id: string; user_id: string; edits: Partial<DishInput>; created_at: string };
export const DISH_WRITE_KEY = ["dishes", "write"] as const;
const FIELDS = ["name", "calories_per_100g", "protein_g_per_100g", "carbs_g_per_100g", "fat_g_per_100g", "fiber_g_per_100g", "reference_serving_g", "is_favorite", "recipe_details", "notes"] as const;
function validatedEdits(input: DishWrite) {
  const edits = Object.fromEntries(FIELDS.filter(key => input.edits[key] !== undefined).map(key => [key, input.edits[key]])) as Partial<DishInput>;
  if (input.operation === "delete") return {};
  if (input.operation === "add" || edits.name !== undefined) {
    if (!edits.name?.trim()) throw new Error("Give your dish a name.");
    edits.name = edits.name.trim();
  }
  for (const key of ["calories_per_100g", "protein_g_per_100g", "carbs_g_per_100g", "fat_g_per_100g", "fiber_g_per_100g"] as const) {
    if (edits[key] != null) finiteNumber(edits[key]!, "Nutrition");
  }
  if (edits.calories_per_100g === null) throw new Error("Calories are required.");
  if (input.operation === "add") finiteNumber(edits.calories_per_100g!, "Calories");
  if (edits.reference_serving_g != null) finiteNumber(edits.reference_serving_g, "Serving size", true);
  if (edits.is_favorite !== undefined && typeof edits.is_favorite !== "boolean") throw new Error("Invalid favorite value.");
  if (edits.notes != null && typeof edits.notes !== "string") throw new Error("Invalid dish notes.");
  if (edits.recipe_details != null) {
    const recipe = parseRecipeDetails(edits.recipe_details);
    if (!recipe) throw new Error("Recipe ingredients are invalid. Recalculate the recipe before saving.");
    edits.recipe_details = recipe;
  }
  return edits;
}
function newDish(input: DishWrite, edits: Partial<DishInput>): Tables<"dishes"> {
  return { id: input.id, user_id: input.user_id, name: "", calories_per_100g: 0, protein_g_per_100g: null, carbs_g_per_100g: null, fat_g_per_100g: null, fiber_g_per_100g: null, reference_serving_g: null, recipe_details: null, name_local: null, notes: null, embedding: null, source: "custom_recipe", is_favorite: false, created_at: input.created_at, updated_at: input.created_at, ...edits };
}
export function registerDishMutationDefaults(qc: QueryClient) {
  qc.setMutationDefaults(DISH_WRITE_KEY, {
    // A queued meal can reference a newly created dish, so share its write order.
    scope: { id: "meal-writes" },
    mutationFn: async (input: DishWrite) => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id !== input.user_id) throw new Error("Sign in to the account that changed this dish to sync it.");
      const edits = validatedEdits(input);
      const result = input.operation === "add"
        ? await supabase.from("dishes").upsert(newDish(input, edits), { onConflict: "id", ignoreDuplicates: true })
        : input.operation === "delete"
          ? await supabase.from("dishes").delete().eq("id", input.id).eq("user_id", input.user_id)
          : await supabase.from("dishes").update({ ...edits, updated_at: input.created_at }).eq("id", input.id).eq("user_id", input.user_id).select("id").single();
      if (result.error) throw result.error;
    },
    onMutate: async (input: DishWrite) => {
      const edits = validatedEdits(input);
      await qc.cancelQueries({ queryKey: ["dishes"] });
      const previous = qc.getQueryData<Tables<"dishes">[]>(["dishes"])?.find(row => row.id === input.id);
      qc.setQueryData<Tables<"dishes">[]>(["dishes"], (old = []) => {
        const rest = old.filter(row => row.id !== input.id);
        const next = input.operation === "delete" ? null : input.operation === "add" ? newDish(input, edits) : previous ? { ...previous, ...edits, updated_at: input.created_at } : null;
        return (next ? [...rest, next] : rest).sort((a, b) => a.name.localeCompare(b.name));
      });
      return { previous };
    },
    onError: (_error, input, context) => {
      if (!context) return;
      qc.setQueryData<Tables<"dishes">[]>(["dishes"], (old = []) => {
        const rest = old.filter(row => row.id !== input.id);
        return (context.previous ? [...rest, context.previous] : rest).sort((a, b) => a.name.localeCompare(b.name));
      });
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ["dishes"] }) === 1) qc.invalidateQueries({ queryKey: ["dishes"] });
    },
  });
}
