// Kenko Smart Points — a food-quality budget inspired by points-based programs,
// not a copy of any proprietary formula. One daily budget derived from the
// calorie target; a food's points rise with energy and fat and fall with
// protein and fiber, so better choices cost less. Whole fruit and non-starchy
// vegetables are zero-point, and a weekly allowance absorbs over-budget days.
import type { Tables } from "./types";
import { addDays, localDateISO } from "./utils";

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

// Zero-point: whole fruit and non-starchy veg, raw or plainly cooked. Dried,
// juiced, sweetened, fried or fat-added forms cost points like any other food.
const STARCHY = ["potato", "cassava", "yam", "plantain", "corn", "maize", "taro", "cocoyam", "tapioca", "pea", "breadfruit"];
const PROCESSED = [
  "juice", "nectar", "dried", "dehydrated", "powder", "raisin", "prune", "date", "syrup", "sweetened", "candied", "maraschino",
  "fried", "sauteed", "breaded", "battered", "creamed", "souffle", "relish", "chip", "oil", "butter", "cheese", "avocado", "olive",
];
const NOT_FREE_FRUIT = ["sauce"];
// Energy-density backstop (kcal per 100 g) for forms the word lists miss.
const ZERO_POINT_MAX_KCAL = 100;

const nameTokens = (name: string) => name.toLowerCase().split(/[^a-z]+/).filter(Boolean);
const hasWord = (tokens: string[], words: string[]) => tokens.some((t) => words.some((w) => t === w || t === `${w}s` || t === `${w}es`));

export function isZeroPointFood(food: { category?: string; name?: string; nutrition?: { calories?: number | null } }): boolean {
  if (food.category !== "Fruits" && food.category !== "Vegetables") return false;
  const name = food.name ?? "";
  const tokens = nameTokens(name);
  if (hasWord(tokens, STARCHY) || hasWord(tokens, PROCESSED)) return false;
  if (food.category === "Fruits" && hasWord(tokens, NOT_FREE_FRUIT)) return false;
  if (/\bwith (added )?sugar\b/i.test(name)) return false;
  // Raw whole fruit is always free; the density cap is for everything else.
  if (food.category === "Fruits" && tokens.includes("raw")) return true;
  const kcal = food.nutrition?.calories;
  return kcal == null || kcal <= ZERO_POINT_MAX_KCAL;
}

// Weekly slack: a small base allowance plus unused daily points rolled over.
export const WEEKLY_ALLOWANCE = 14;
export const ROLLOVER_CAP = 4;

/** Monday (local) of the week containing an ISO day. */
export function weekStartISO(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type PointsDay = { day: string; budget: number; spent: number; logged: boolean };

/**
 * Weekly points as of `day`. Earlier logged days roll over up to ROLLOVER_CAP
 * unused points each; any day's overspend (including `day`) draws the bank down.
 */
export function weeklyPoints(days: PointsDay[], day: string) {
  const start = weekStartISO(day);
  const week = days.filter((d) => d.day >= start && d.day <= day);
  const rolledOver = week.reduce((sum, d) => sum + (d.day < day && d.logged ? Math.min(ROLLOVER_CAP, Math.max(0, d.budget - d.spent)) : 0), 0);
  const used = week.reduce((sum, d) => sum + Math.max(0, d.spent - d.budget), 0);
  const allowance = WEEKLY_ALLOWANCE + rolledOver;
  return { allowance, rolledOver, used, left: allowance - used };
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

/** Per-day points for the week of `day`, from that week's rows and each day's budget. */
export function weekPointsDays(rows: (Parameters<typeof mealPoints>[0] & { logged_at: string })[] | undefined, day: string, budgetFor: (day: string) => number): PointsDay[] {
  const byDay = new Map<string, Parameters<typeof mealPoints>[0][]>();
  for (const row of rows ?? []) {
    const key = localDateISO(new Date(row.logged_at));
    byDay.set(key, [...(byDay.get(key) ?? []), row]);
  }
  const days: PointsDay[] = [];
  for (let d = weekStartISO(day); d <= day; d = localDateISO(addDays(new Date(`${d}T12:00:00`), 1))) {
    const logs = byDay.get(d) ?? [];
    days.push({ day: d, budget: budgetFor(d), spent: dayPoints(logs), logged: logs.length > 0 });
  }
  return days;
}
