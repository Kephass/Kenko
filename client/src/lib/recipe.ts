import { finiteNumber } from "./tracking";

export const RECIPE_NUTRIENTS = ["calories_per_100g", "protein_g_per_100g", "carbs_g_per_100g", "fat_g_per_100g", "fiber_g_per_100g"] as const;
type Nutrient = (typeof RECIPE_NUTRIENTS)[number];
export type RecipeFood = { id: string; name: string } & Record<Nutrient, number | null>;
export type RecipeIngredient = { food: RecipeFood; grams: string | number };

/** Ingredient totals are conserved; cooked batch weight determines nutrient density. */
export function calculateRecipe(ingredients: RecipeIngredient[], yieldGrams: string | number, servings: string | number) {
  if (!ingredients.length) throw new Error("Add at least one ingredient.");
  const weight = finiteNumber(yieldGrams, "Finished weight", true);
  const count = finiteNumber(servings, "Servings", true);
  const totals = Object.fromEntries(RECIPE_NUTRIENTS.map(key => [key, 0])) as Record<Nutrient, number>;
  const missing = new Set<Nutrient>();
  for (const { food, grams } of ingredients) {
    const factor = finiteNumber(grams, `${food.name} weight`, true) / 100;
    for (const key of RECIPE_NUTRIENTS) {
      if (food[key] == null) missing.add(key);
      totals[key] += finiteNumber(food[key] ?? 0, `${food.name} nutrition`) * factor;
    }
  }
  const per100g = Object.fromEntries(RECIPE_NUTRIENTS.map(key => [key, finiteNumber(totals[key] * 100 / weight, "Calculated nutrition")])) as Record<Nutrient, number>;
  const servingGrams = finiteNumber(weight / count, "Calculated serving weight", true);
  return { per100g, servingGrams, caloriesPerServing: finiteNumber(totals.calories_per_100g / count, "Serving calories"), missing: [...missing] };
}

export type RecipeDetails = { version: 1; ingredients: { food: RecipeFood; grams: number }[]; yieldGrams: number; servings: number };
export function parseRecipeDetails(value: unknown): RecipeDetails | null {
  try {
    if (!value || typeof value !== "object") return null;
    const raw = value as Record<string, unknown>;
    if (raw.version !== 1 || !Array.isArray(raw.ingredients) || raw.ingredients.length < 1 || raw.ingredients.length > 100 || typeof raw.yieldGrams !== "number" || typeof raw.servings !== "number") return null;
    const ingredients = raw.ingredients.map((entry: unknown) => {
      if (!entry || typeof entry !== "object") throw new Error("Invalid ingredient");
      const item = entry as Record<string, unknown>;
      if (typeof item.grams !== "number" || !item.food || typeof item.food !== "object") throw new Error("Invalid ingredient");
      const source = item.food as Record<string, unknown>;
      if (typeof source.id !== "string" || !source.id || source.id.length > 128 || typeof source.name !== "string" || !source.name.trim() || source.name.length > 500) throw new Error("Invalid ingredient name");
      const nutrients = Object.fromEntries(RECIPE_NUTRIENTS.map(key => {
        const nutrient = source[key];
        if (nutrient !== null && typeof nutrient !== "number") throw new Error("Invalid nutrient");
        return [key, nutrient === null ? null : finiteNumber(nutrient, "Nutrition")];
      })) as Record<Nutrient, number | null>;
      return { food: { id: source.id, name: source.name, ...nutrients }, grams: finiteNumber(item.grams, "Ingredient weight", true) };
    });
    calculateRecipe(ingredients, raw.yieldGrams, raw.servings);
    return { version: 1, ingredients, yieldGrams: raw.yieldGrams, servings: raw.servings };
  } catch { return null; }
}
