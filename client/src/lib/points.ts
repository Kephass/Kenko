// Kenko Smart Points — a food-quality budget inspired by points-based programs,
// not a copy of any proprietary formula. One daily budget derived from the
// calorie target; a food's points rise with energy and fat and fall with
// protein and fiber, so better choices cost less. Whole fruit and non-starchy
// vegetables are zero-point.
import type { Tables } from "./types";

// ~40 kcal per point keeps a points-based program's scale: a maintenance day
// (~2,000 kcal) is ~50 points, and a typical weight-loss target (~1,450 kcal)
// lands near ~36 — close to a WeightWatchers-style daily allowance.
export const CAL_PER_POINT = 40;
// Food quality adjusts the raw energy in calorie-equivalents before dividing, so
// changing CAL_PER_POINT rescales budget and food points together.
const FAT_KCAL = 8.25; // per gram of fat (also our stand-in for saturated fat)
const PROTEIN_KCAL = 3.3; // per gram of protein, credited (capped)
const FIBER_KCAL = 4.95; // per gram of fiber, credited (capped)
const PROTEIN_CAP = 60;
const FIBER_CAP = 15;

export type FoodNutrition = {
  calories: number;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
};

const nonNeg = (value: number | null | undefined) => (value != null && value > 0 ? value : 0);

/** Smart points for one food's absolute nutrition (not per 100 g). Never negative. */
export function smartFoodPoints(n: FoodNutrition): number {
  const adjustedKcal =
    nonNeg(n.calories) +
    nonNeg(n.fat_g) * FAT_KCAL -
    Math.min(nonNeg(n.protein_g), PROTEIN_CAP) * PROTEIN_KCAL -
    Math.min(nonNeg(n.fiber_g), FIBER_CAP) * FIBER_KCAL;
  return Math.max(0, Math.round(adjustedKcal / CAL_PER_POINT));
}

/** Daily points budget from the calorie target. */
export function pointsBudget(calorieTarget: number): number {
  return Math.max(0, Math.round(nonNeg(calorieTarget) / CAL_PER_POINT));
}

// Whole fruit and non-starchy vegetables are zero-point; starchy staples and
// juices are not. Matched by catalog category plus a small name check.
const STARCHY = ["potato", "cassava", "yam", "plantain", "corn", "maize", "sweet potato", "taro", "cocoyam", "tapioca", "pea", "breadfruit"];
const NOT_FREE_FRUIT = ["juice", "dried", "syrup", "sweetened", "candied", "sauce"];

export function isZeroPointFood(food: { category?: string; name?: string }): boolean {
  const name = (food.name ?? "").toLowerCase();
  if (food.category === "Fruits") return !NOT_FREE_FRUIT.some((t) => name.includes(t));
  if (food.category === "Vegetables") return !STARCHY.some((t) => name.includes(t));
  return false;
}

/** Points for a logged meal row: the stored value, or computed from macros. */
export function mealPoints(row: Pick<Tables<"meal_logs">, "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g"> & { points?: number | null }): number {
  if (row.points != null && Number.isFinite(Number(row.points))) return Math.max(0, Math.round(Number(row.points)));
  return smartFoodPoints(row);
}

/** Sum of points across a day's logged rows. */
export function dayPoints(rows: (Parameters<typeof mealPoints>[0])[] | undefined): number {
  return (rows ?? []).reduce((total, row) => total + mealPoints(row), 0);
}
