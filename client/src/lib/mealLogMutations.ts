import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/types";
import { finiteNumber } from "./tracking";
import { smartFoodPoints } from "./points";
import { localDateISO } from "@/lib/utils";

// Default points from macros when a caller doesn't set them. Zero-point foods
// (fruit, non-starchy veg) pass points: 0 explicitly and are preserved by ??.
function withPoints<T extends { points?: number | null; calories: number }>(input: T): T & { points: number } {
  return { ...input, points: input.points ?? smartFoodPoints(input) };
}

export type ManualMealInput = {
  /** Client-generated so a re-resumed offline mutation can't insert twice. */
  id: string;
  user_id: string;
  logged_at: string;
  fiber_g?: number | null;
  meal_type?: "breakfast" | "lunch" | "dinner" | "snack" | "uncategorized";
  dish_id?: string;
  portion_ratio?: number;
  calories: number;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  points?: number | null;
  raw_text_input?: string;
};

export const ADD_MANUAL_MEAL_KEY = ["meal_logs", "add-manual"] as const;

type MealLogRow = Tables<"meal_logs">;
type MutationContext = { queryKey: readonly unknown[]; previous: MealLogRow[] | undefined };

/** Verify the original author again when an offline entry resumes. */
async function addManualMealLog(input: ManualMealInput) {
  const { data } = await supabase.auth.getSession();
  if (!data.session || input.user_id !== data.session.user.id) throw new Error("Sign in to the account that created this meal to sync it.");
  finiteNumber(input.calories, "Calories");
  for (const value of [input.protein_g, input.carbs_g, input.fat_g, input.fiber_g, input.points]) if (value != null) finiteNumber(value, "Nutrients");
  if (!input.logged_at || !Number.isFinite(new Date(input.logged_at).getTime())) throw new Error("Meal date is missing or invalid.");
  // ignoreDuplicates makes replays (persisted queue restored twice) a no-op.
  const { error } = await supabase
    .from("meal_logs")
    .upsert(
      { ...withPoints(input), user_id: data.session.user.id, source: "manual", confirmed: true },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

/**
 * Module-scope mutation defaults so paused (offline) mutations can resume
 * after a reload, when the hook's inline options aren't around anymore.
 * The optimistic insert targets the meal's original local day while offline.
 */
export function registerMealLogMutationDefaults(qc: QueryClient) {
  registerMealCorrectionDefaults(qc);
  qc.setMutationDefaults(ADD_MANUAL_MEAL_KEY, {
    scope: { id: "meal-writes" },
    mutationFn: addManualMealLog,
    onMutate: async (input: ManualMealInput): Promise<MutationContext> => {
      const queryKey = ["meal_logs", "day", localDateISO(new Date(input.logged_at))] as const;
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<MealLogRow[]>(queryKey);
      const optimistic = {
        id: input.id,
        logged_at: input.logged_at,
        user_id: input.user_id,
        fiber_g: input.fiber_g ?? null,
        created_at: new Date().toISOString(),
        photo_url: null, dishware_id: null, match_confidence: null,
        meal_type: input.meal_type ?? "uncategorized",
        source: "manual",
        confirmed: true,
        dish_id: input.dish_id ?? null,
        portion_ratio: input.portion_ratio ?? null,
        calories: input.calories,
        protein_g: input.protein_g ?? null,
        carbs_g: input.carbs_g ?? null,
        fat_g: input.fat_g ?? null,
        points: input.points ?? smartFoodPoints(input),
        raw_text_input: input.raw_text_input ?? null,
      } as MealLogRow;
      qc.setQueryData<MealLogRow[]>(queryKey, (old) => [optimistic, ...(old ?? []).filter((row) => row.id !== input.id)].sort((a, b) => b.logged_at.localeCompare(a.logged_at)));
      return { queryKey, previous };
    },
    onError: (_error, _input, context) => {
      const ctx = context as MutationContext | undefined;
      if (ctx) qc.setQueryData<MealLogRow[]>(ctx.queryKey, (old) => old?.filter((row) => row.id !== _input.id));
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ["meal_logs"] }) > 1) return;
      qc.invalidateQueries({ queryKey: ["meal_logs"] });
      qc.invalidateQueries({ queryKey: ["daily_summary"] });
      qc.invalidateQueries({ queryKey: ["weekly_balance"] });
    },
  });
}

export const UPDATE_MEAL_KEY = ["meal_logs", "update"] as const;
export const RESTORE_MEAL_KEY = ["meal_logs", "restore"] as const;
export const DELETE_MEAL_KEY = ["meal_logs", "delete"] as const;
export type MealEdits = Partial<Pick<MealLogRow, "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "points" | "logged_at" | "raw_text_input" | "meal_type">>;
export type MealUpdate = { row: MealLogRow; edits: MealEdits };
type Correction = { row: MealLogRow; edits?: MealEdits };
type CorrectionContext = { snapshots: { key: readonly unknown[]; previous?: MealLogRow }[] };

function sortedMeals(rows: MealLogRow[]) {
  return rows.sort((a, b) => b.logged_at.localeCompare(a.logged_at));
}

/** Registered alongside additions so corrections also survive a reload. */
function registerMealCorrectionDefaults(qc: QueryClient) {
  for (const operation of ["update", "delete", "restore"] as const) {
    qc.setMutationDefaults(operation === "update" ? UPDATE_MEAL_KEY : operation === "delete" ? DELETE_MEAL_KEY : RESTORE_MEAL_KEY, {
      scope: { id: "meal-writes" },
      mutationFn: async ({ row, edits = {} }: Correction) => {
        const { data } = await supabase.auth.getSession();
        if (!data.session || data.session.user.id !== row.user_id) throw new Error("Sign in to the account that created this meal to sync it.");
        if (operation === "delete") {
          const { error } = await supabase.from("meal_logs").delete().eq("id", row.id).eq("user_id", row.user_id);
          if (error) throw error;
          return;
        }
        if (operation === "restore") {
          const { error } = await supabase.from("meal_logs").upsert(row, { onConflict: "id", ignoreDuplicates: true });
          if (error) throw error;
          return;
        }
        // Pick fields explicitly: persisted input cannot alter owner, id or source.
        const patch: MealEdits = {};
        for (const key of ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "points"] as const) {
          if (edits[key] !== undefined) {
            if (edits[key] != null) finiteNumber(edits[key]!, "Nutrition");
            Object.assign(patch, { [key]: edits[key] });
          }
        }
        if (edits.logged_at !== undefined) {
          if (!Number.isFinite(new Date(edits.logged_at).getTime())) throw new Error("Meal date is invalid.");
          patch.logged_at = edits.logged_at;
        }
        if (edits.meal_type !== undefined) {
          if (!["breakfast", "lunch", "dinner", "snack", "uncategorized"].includes(edits.meal_type)) throw new Error("Choose a valid meal category.");
          patch.meal_type = edits.meal_type;
        }
        if (edits.raw_text_input !== undefined) patch.raw_text_input = edits.raw_text_input;
        const { error } = await supabase.from("meal_logs").update(patch).eq("id", row.id).eq("user_id", row.user_id).select("id").single();
        if (error) throw error;
      },
      onMutate: async ({ row, edits = {} }: Correction): Promise<CorrectionContext> => {
        await qc.cancelQueries({ queryKey: ["meal_logs"] });
        const next = { ...row, ...edits };
        const destination = localDateISO(new Date(next.logged_at));
        const entries = qc.getQueriesData<MealLogRow[]>({ queryKey: ["meal_logs"] }).filter(([key]) => key[1] === "day" || key[1] === "recent");
        if (operation !== "delete" && !entries.some(([key]) => key[1] === "day" && key[2] === destination)) entries.push([["meal_logs", "day", destination], undefined]);
        const snapshots = entries.map(([key, rows]) => ({ key, previous: rows?.find((m) => m.id === row.id) }));
        for (const [key, rows = []] of entries) {
          const rest = rows.filter((m) => m.id !== row.id);
          const include = operation !== "delete" && (key[1] === "recent" ? rows.some((m) => m.id === row.id) : key[2] === destination);
          qc.setQueryData(key, include ? sortedMeals([next, ...rest]) : rest);
        }
        return { snapshots };
      },
      onError: (_error, { row }, context) => {
        if (!context) return;
        for (const { key, previous } of context.snapshots) {
          qc.setQueryData<MealLogRow[]>(key, (rows = []) => {
            const rest = rows.filter((m) => m.id !== row.id);
            return previous ? sortedMeals([previous, ...rest]) : rest;
          });
        }
      },
      onSettled: () => {
        if (qc.isMutating({ mutationKey: ["meal_logs"] }) > 1) return;
        qc.invalidateQueries({ queryKey: ["meal_logs"] });
        qc.invalidateQueries({ queryKey: ["daily_summary"] });
        qc.invalidateQueries({ queryKey: ["weekly_balance"] });
      },
    });
  }
}
