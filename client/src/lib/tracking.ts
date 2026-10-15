export function finiteNumber(value: string | number, label: string, positive = false) {
  const n = typeof value === "string" && !value.trim() ? NaN : Number(value);
  if (!Number.isFinite(n) || (positive ? n <= 0 : n < 0)) {
    throw new Error(`${label} must be ${positive ? "greater than zero" : "zero or greater"}.`);
  }
  return n;
}

export function localDateTime(d: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function logTimestamp(value: string) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 60_000) {
    throw new Error("Choose a valid date and time up to now.");
  }
  return date.toISOString();
}

export type PortionUnit = "grams" | "servings" | "ounces";
const GRAMS_PER_OUNCE = 28.349523125;
function gramsPerUnit(unit: PortionUnit, serving: number | null) {
  return unit === "grams" ? 1 : unit === "ounces" ? GRAMS_PER_OUNCE : finiteNumber(serving ?? 100, "Serving size", true);
}
export function portionGrams(amount: string, unit: PortionUnit, serving: number | null) {
  return finiteNumber(finiteNumber(amount, "Portion", true) * gramsPerUnit(unit, serving), "Portion", true);
}
export function portionFromGrams(grams: number, unit: PortionUnit, serving: number | null) {
  return finiteNumber(finiteNumber(grams, "Portion", true) / gramsPerUnit(unit, serving), "Portion", true);
}

export function optionalNutrient(value: string | undefined, label: string) {
  return value == null || !value.trim() ? null : finiteNumber(value, label);
}
export function nutrientInputValue(value: number | null | undefined) { return value == null ? "" : String(value); }
export function formatNutrient(value: number | null | undefined) { return value == null ? "Not entered" : `${Math.round(value * 10) / 10} g`; }
export function hasMissingNutrients(meal: { protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null; fiber_g?: number | null }) {
  return [meal.protein_g, meal.carbs_g, meal.fat_g, meal.fiber_g].some(value => value == null);
}

export function nutritionInput(values: Record<string, string>) {
  return {
    calories: finiteNumber(values.calories, "Calories"),
    protein_g: optionalNutrient(values.protein, "Protein"),
    carbs_g: optionalNutrient(values.carbs, "Carbohydrates"),
    fat_g: optionalNutrient(values.fat, "Fat"),
    fiber_g: optionalNutrient(values.fiber, "Fiber"),
  };
}

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "uncategorized"] as const;
export type MealType = (typeof MEAL_TYPES)[number];
export function mealTypeForTime(date = new Date()): MealType {
  const hour = date.getHours();
  return hour >= 5 && hour < 11 ? "breakfast" : hour >= 11 && hour < 15 ? "lunch" : hour >= 17 && hour < 22 ? "dinner" : "snack";
}


/** Scale a previous portion while preserving nutrients that were never entered. */
export function repeatNutrition(meal: { calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null }, multiplier: string) {
  const factor = finiteNumber(multiplier, "Portion multiplier", true);
  const scale = (value: number | null, label: string) => value == null ? "" : String(finiteNumber(finiteNumber(value, label) * factor, label));
  return { calories: scale(meal.calories, "Calories"), protein: scale(meal.protein_g, "Protein"), carbs: scale(meal.carbs_g, "Carbohydrates"), fat: scale(meal.fat_g, "Fat"), fiber: scale(meal.fiber_g, "Fiber") };
}

export function diaryDate(value: string | null, today: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return today;
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return today;
  const roundTrip = `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return roundTrip === value ? value : today;
}

export function initialLogTime(day: string, now: Date = new Date()) {
  const current = localDateTime(now);
  const selected = diaryDate(day, current.slice(0, 10));
  return selected === current.slice(0, 10) ? current : `${selected}T12:00`;
}

export type NutritionBasis = "100g" | "serving";
export function convertLabelValue(value: string, from: NutritionBasis, to: NutritionBasis, servingGrams: string) {
  if (!value.trim()) return "";
  const amount = finiteNumber(value, "Nutrition");
  if (from === to) return String(amount);
  const serving = finiteNumber(servingGrams, "Serving weight", true);
  return String(finiteNumber(amount * (to === "100g" ? 100 / serving : serving / 100), "Converted nutrition"));
}

/** Keep measured/repeated quantities in immutable diary labels. */
export function measuredFoodName(name: string, grams: number) {
  return `${name.trim()} · ${Number(finiteNumber(grams, "Food weight", true).toFixed(4))} g`;
}
export function repeatedFoodName(name: string, multiplier: string) {
  const factor = finiteNumber(multiplier, "Portion multiplier", true);
  return factor === 1 ? name.trim() : `${factor}× previous amount · ${name.trim()}`;
}
