import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { deriveDailyGoals } from "./goals";
import type { Tables } from "./types";
export type DailyGoals = ReturnType<typeof deriveDailyGoals>;
export type TargetSnapshot = Tables<"daily_target_snapshots">;
export const TARGET_SNAPSHOT_KEY = ["daily_target_snapshots", "write"] as const;
export function validateGoals(value: unknown): DailyGoals {
  if (!value || typeof value !== "object") throw new Error("Invalid daily targets.");
  const goals = value as DailyGoals;
  for (const key of ["calorieTarget", "protein", "carbs", "fat", "water", "fiber"] as const) {
    if (typeof goals[key] !== "number" || !Number.isFinite(goals[key]) || goals[key] <= 0) throw new Error("Invalid daily targets.");
  }
  if (typeof goals.isFallback !== "boolean") throw new Error("Invalid target source.");
  return { calorieTarget: goals.calorieTarget, protein: goals.protein, carbs: goals.carbs, fat: goals.fat, water: goals.water, fiber: goals.fiber, isFallback: goals.isFallback };
}
export function targetsOnDay(rows: TargetSnapshot[] | undefined, day: string): DailyGoals | null {
  const latest = rows?.filter(row => row.day === day).sort((a, b) => b.observed_at.localeCompare(a.observed_at) || b.id.localeCompare(a.id))[0];
  if (!latest) return null;
  try { return validateGoals(latest.goals); } catch { return null; }
}
export function registerTargetSnapshotDefaults(qc: QueryClient) {
  qc.setMutationDefaults(TARGET_SNAPSHOT_KEY, {
    scope: { id: "target-snapshots" },
    mutationFn: async (input: TargetSnapshot) => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id !== input.user_id) throw new Error("Sign in to the original account to save these targets.");
      const goals = validateGoals(input.goals);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day) || !Number.isFinite(Date.parse(input.observed_at))) throw new Error("Invalid target date.");
      const { error } = await supabase.from("daily_target_snapshots").upsert({ ...input, goals }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      qc.setQueriesData<TargetSnapshot[]>({ queryKey: ["daily_target_snapshots", input.user_id] }, rows => rows ? [...rows.filter(row => row.id !== input.id), input] : rows);
      void qc.invalidateQueries({ queryKey: ["daily_target_snapshots", input.user_id] });
    },
  });
}
