import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/types";
import { localDateISO } from "@/lib/utils";

export type ManualMealInput = {
  /** Client-generated so a re-resumed offline mutation can't insert twice. */
  id: string;
  dish_id?: string;
  portion_ratio?: number;
  calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  raw_text_input?: string;
};

export const ADD_MANUAL_MEAL_KEY = ["meal_logs", "add-manual"] as const;

type MealLogRow = Tables<"meal_logs">;
type MutationContext = { queryKey: readonly unknown[]; previous: MealLogRow[] | undefined };

/** Resolves the user at execution time so queued offline mutations survive a reload. */
async function addManualMealLog(input: ManualMealInput) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Not signed in");
  // ignoreDuplicates makes replays (persisted queue restored twice) a no-op.
  const { error } = await supabase
    .from("meal_logs")
    .upsert(
      { ...input, user_id: data.session.user.id, source: "manual", confirmed: true },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

/**
 * Module-scope mutation defaults so paused (offline) mutations can resume
 * after a reload, when the hook's inline options aren't around anymore.
 * The optimistic insert keeps today's meal list correct while offline.
 */
export function registerMealLogMutationDefaults(qc: QueryClient) {
  qc.setMutationDefaults(ADD_MANUAL_MEAL_KEY, {
    mutationFn: addManualMealLog,
    onMutate: async (input: ManualMealInput): Promise<MutationContext> => {
      const queryKey = ["meal_logs", "day", localDateISO()] as const;
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<MealLogRow[]>(queryKey);
      const optimistic = {
        id: input.id,
        logged_at: new Date().toISOString(),
        source: "manual",
        confirmed: true,
        dish_id: input.dish_id ?? null,
        portion_ratio: input.portion_ratio ?? null,
        calories: input.calories,
        protein_g: input.protein_g ?? null,
        carbs_g: input.carbs_g ?? null,
        fat_g: input.fat_g ?? null,
        raw_text_input: input.raw_text_input ?? null,
      } as MealLogRow;
      qc.setQueryData<MealLogRow[]>(queryKey, (old) => [optimistic, ...(old ?? [])]);
      return { queryKey, previous };
    },
    onError: (_error, _input, context) => {
      const ctx = context as MutationContext | undefined;
      if (ctx) qc.setQueryData(ctx.queryKey, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["meal_logs"] });
      qc.invalidateQueries({ queryKey: ["daily_summary"] });
      qc.invalidateQueries({ queryKey: ["weekly_balance"] });
    },
  });
}
