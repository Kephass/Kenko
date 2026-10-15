import { finiteNumber } from "./tracking";
import type { Tables } from "./types";

export function deriveDailyGoals(caloriesOut7d: number | null | undefined, profile?: Partial<Tables<"user_profile">> | null) {
  const maintenance = caloriesOut7d && Number.isFinite(Number(caloriesOut7d)) && caloriesOut7d > 0
    ? Number(caloriesOut7d) / 7 : 2000;
  const calorieTarget = profile?.calorie_target_override ?? maintenance;
  return {
    calorieTarget,
    protein: (calorieTarget * (profile?.protein_pct ?? 30) / 100) / 4,
    carbs: (calorieTarget * (profile?.carbs_pct ?? 40) / 100) / 4,
    fat: (calorieTarget * (profile?.fat_pct ?? 30) / 100) / 9,
    water: profile?.water_goal_ml ?? 2000,
    fiber: profile?.fiber_goal_g ?? 25,
    isFallback: profile?.calorie_target_override == null && !(caloriesOut7d && Number.isFinite(Number(caloriesOut7d)) && caloriesOut7d > 0),
  };
}

export type TargetForm = { calorie_target_override: string; protein_pct: string; carbs_pct: string; fat_pct: string; water_goal_ml: string; fiber_goal_g: string };
export function targetForm(profile?: Partial<Tables<"user_profile">> | null): TargetForm {
  return {
    calorie_target_override: profile?.calorie_target_override?.toString() ?? "",
    protein_pct: String(profile?.protein_pct ?? 30), carbs_pct: String(profile?.carbs_pct ?? 40), fat_pct: String(profile?.fat_pct ?? 30),
    water_goal_ml: String(profile?.water_goal_ml ?? 2000), fiber_goal_g: String(profile?.fiber_goal_g ?? 25),
  };
}

export function parseTargets(form: TargetForm) {
  const protein_pct = finiteNumber(form.protein_pct, "Protein percentage", true);
  const carbs_pct = finiteNumber(form.carbs_pct, "Carbohydrate percentage", true);
  const fat_pct = finiteNumber(form.fat_pct, "Fat percentage", true);
  if (Math.abs(protein_pct + carbs_pct + fat_pct - 100) > 0.000001) throw new Error("Macro percentages must add up to 100%.");
  return {
    calorie_target_override: form.calorie_target_override.trim() ? finiteNumber(form.calorie_target_override, "Calorie target", true) : null,
    protein_pct, carbs_pct, fat_pct,
    water_goal_ml: finiteNumber(form.water_goal_ml, "Water goal", true),
    fiber_goal_g: finiteNumber(form.fiber_goal_g, "Fiber goal", true),
  };
}
