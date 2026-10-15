import type { Tables } from "./types";
import type { DishInput } from "./dishMutations";
import { finiteNumber, nutritionInput, repeatNutrition, localDateTime, type MealType } from "./tracking";
import { makeMealCopy } from "./copyMeal";
import { saveMealSnapshot, type SavedFood } from "./savedMeals";
export type CatalogFood = { id: string; name: string; category: string; nutrition: { calories: number; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null }; portions: { label: string; grams: number }[]; estimated: boolean; recipe?: string };
export const PREPARATIONS = ["Raw", "Cooked", "Canned", "Dried", "Frozen"] as const;
export type Preparation = typeof PREPARATIONS[number];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const aliases: Record<string, string> = {
  aubergine: "eggplant", aubergines: "eggplant", eggplants: "eggplant",
  courgette: "zucchini", courgettes: "zucchini", zucchinis: "zucchini",
  garbanzo: "chickpea", garbanzos: "chickpea", chickpeas: "chickpea",
  rocket: "arugula", scallion: "scallions", groundnut: "peanut", groundnuts: "peanut", peanuts: "peanut",
  beetroot: "beet", beetroots: "beet", capsicum: "pepper", capsicums: "pepper",
};
function words(value: string) { return normalize(value).split(/[^a-z0-9]+/).filter(Boolean); }
function searchWords(value: string) { return words(value).map(word => aliases[word] ?? word); }
export function foodPreparations(food: CatalogFood): Preparation[] {
  const tokens = words(food.name);
  const matches: Record<Preparation, string[]> = {
    Raw: ["raw", "uncooked"], Cooked: ["cooked", "boiled", "baked", "roasted", "steamed", "fried", "grilled"],
    Canned: ["canned"], Dried: ["dried", "dehydrated"], Frozen: ["frozen"],
  };
  return PREPARATIONS.filter(preparation => tokens.some(token => matches[preparation].includes(token)));
}
export function searchCatalog(foods: CatalogFood[], query: string, category: string, preparation: Preparation | "" = "") {
  const terms = searchWords(query);
  const matches = foods.filter(food => {
    if ((category && food.category !== category) || (preparation && !foodPreparations(food).includes(preparation))) return false;
    const tokens = searchWords(food.name);
    return terms.every(term => tokens.some(word => word.startsWith(term)));
  });
  // Prefer a food's main name over incidental ingredients in longer descriptions.
  if (terms.length) matches.sort((a, b) => {
    const score = (food: CatalogFood) => (searchWords(food.name)[0]?.startsWith(terms[0]) ? 100 : 0) - words(food.name).length;
    return score(b) - score(a) || a.name.localeCompare(b.name);
  });
  return matches;
}
export function catalogNutrition(food: CatalogFood, grams: string | number) {
  const weight = finiteNumber(grams, "Weight", true);
  const scaled = (value: number | null) => value === null ? "" : String(Math.round(finiteNumber(value * weight / 100, "Nutrition") * 10000) / 10000);
  return { calories: scaled(food.nutrition.calories), protein: scaled(food.nutrition.protein), carbs: scaled(food.nutrition.carbs), fat: scaled(food.nutrition.fat), fiber: scaled(food.nutrition.fiber) };
}

export function catalogDish(food: CatalogFood, servingGrams: number): DishInput {
  return {
    name: `${food.name}${food.estimated ? " (estimate)" : ""}`,
    calories_per_100g: food.nutrition.calories,
    protein_g_per_100g: food.nutrition.protein,
    carbs_g_per_100g: food.nutrition.carbs,
    fat_g_per_100g: food.nutrition.fat,
    fiber_g_per_100g: food.nutrition.fiber,
    reference_serving_g: finiteNumber(servingGrams, "Serving size", true),
    notes: `Kenko catalog: ${food.id}\n${food.recipe || `USDA SR Legacy (2018): https://fdc.nal.usda.gov/food-details/${food.id}/nutrients`}\n${food.estimated ? "Recipe estimate; ingredients and portions vary." : "Reference nutrition; edible weight only."}`,
  };
}

export type CatalogPortion = { id: string; food: CatalogFood; grams: string };
export type QuickPortion = { id: string; quick: SavedFood; portions: string };
export type BasketPortion = CatalogPortion | QuickPortion;
export function quickBasketPortion(name: string, values: Record<string, string>): QuickPortion {
  if (!name.trim() || name.trim().length > 500) throw new Error("Give this food a name of up to 500 characters.");
  return { id: crypto.randomUUID(), quick: { name: name.trim(), ...nutritionInput(values) }, portions: "1" };
}
export const basketNutrition = (item: BasketPortion) => "quick" in item ? repeatNutrition(item.quick, item.portions) : catalogNutrition(item.food, item.grams);
export function basketFoodName(item: BasketPortion) {
  return "quick" in item ? `${item.quick.name} · ${finiteNumber(item.portions, "Portions", true)}× entered amount`
    : `${item.food.name} · ${finiteNumber(item.grams, "Weight", true)} g${item.food.estimated ? " (estimate)" : ""}`;
}
export function catalogMeal(items: BasketPortion[], userId: string, when: string, mealType: MealType) {
  if (!userId) throw new Error("Sign in to log a meal.");
  if (!items.length || items.length > 100) throw new Error("Choose between 1 and 100 foods.");
  const rows = items.map(item => ({
    id: item.id, user_id: userId,
    raw_text_input: basketFoodName(item),
    ...nutritionInput(basketNutrition(item)),
    created_at: new Date().toISOString(), logged_at: when, meal_type: mealType,
    confirmed: true, source: "manual", dish_id: null, dishware_id: null,
    portion_ratio: null, photo_url: null, match_confidence: null,
  }));
  return makeMealCopy(rows, userId, when, mealType);
}

export function saveCatalogTemplate(items: BasketPortion[], userId: string, name: string, mealType: MealType) {
  const snapshot = catalogMeal(items, userId, localDateTime(), mealType);
  return saveMealSnapshot(snapshot.rows, userId, name, mealType);
}

export function savedDishCatalogFood(dish: Tables<"dishes">): CatalogFood {
  return {
    id: `personal:${dish.id}`, name: dish.name, category: "My dishes", estimated: dish.source === "estimated",
    nutrition: {
      calories: Number(dish.calories_per_100g),
      protein: dish.protein_g_per_100g == null ? null : Number(dish.protein_g_per_100g),
      carbs: dish.carbs_g_per_100g == null ? null : Number(dish.carbs_g_per_100g),
      fat: dish.fat_g_per_100g == null ? null : Number(dish.fat_g_per_100g),
      fiber: dish.fiber_g_per_100g == null ? null : Number(dish.fiber_g_per_100g),
    },
    portions: dish.reference_serving_g ? [{ label: "1 serving", grams: Number(dish.reference_serving_g) }] : [],
  };
}

export const BASKET_NUTRIENTS = ["protein", "carbs", "fat", "fiber"] as const;
export function basketTotals(items: BasketPortion[]) {
  const totals = { calories: 0, nutrients: Object.fromEntries(BASKET_NUTRIENTS.map(key => [key, { total: 0, missing: 0 }])) as Record<typeof BASKET_NUTRIENTS[number], { total: number; missing: number }> };
  for (const item of items) {
    const values = basketNutrition(item);
    totals.calories = finiteNumber(totals.calories + Number(values.calories), "Total calories");
    for (const key of BASKET_NUTRIENTS) {
      if (values[key] === "") totals.nutrients[key].missing++;
      else totals.nutrients[key].total = finiteNumber(totals.nutrients[key].total + Number(values[key]), "Total nutrients");
    }
  }
  return totals;
}
