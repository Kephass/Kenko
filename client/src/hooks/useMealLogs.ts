"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Tables, TablesUpdate } from "@/lib/types";
import { useSession } from "@/components/Providers";
import { ADD_MANUAL_MEAL_KEY, UPDATE_MEAL_KEY, DELETE_MEAL_KEY, RESTORE_MEAL_KEY, type MealUpdate, type ManualMealInput } from "@/lib/mealLogMutations";
import { loadLogStreak } from "@/lib/logStreak";
import { dayRange, localDateISO } from "@/lib/utils";

export function useMealLogsForDay(day: string) {
  return useQuery({
    queryKey: ["meal_logs", "day", day],
    staleTime: 60_000,
    queryFn: async () => {
      const range = dayRange(day);
      const rows: Tables<"meal_logs">[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("meal_logs").select("*")
          .gte("logged_at", range.start).lt("logged_at", range.end)
          .order("logged_at", { ascending: false }).order("id", { ascending: false })
          .range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) return rows;
      }
    },
  });
}

/** Consecutive days with a confirmed log; today counts if logged, else counted from yesterday. */
export function useLogStreak() {
  const session = useSession();
  const today = localDateISO();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return useQuery({
    queryKey: ["meal_logs", "streak", session?.user.id, today, timezone],
    enabled: !!session,
    staleTime: 60_000,
    queryFn: () => loadLogStreak(async (start, end) => {
      const { data, error } = await supabase.rpc("daily_nutrition_summary_v2", {
        p_user_id: session!.user.id, p_start: start, p_end: end, p_tz: timezone,
      });
      if (error) throw error;
      return data.filter(row => Number(row.meal_count) > 0).map(row => row.day);
    }, today),
  });
}

/** POST to the log-meal edge function; returns the draft meal_logs row. */
export function useLogMeal() {
  const session = useSession();
  return useMutation({
    // No auto-retry: a lost response after a successful AI call would duplicate the log.
    retry: false,
    mutationFn: async (input: { imageBase64?: string; textInput?: string; dishwareId?: string }) => {
      const { data, error } = await supabase.functions.invoke("log-meal", {
        body: { userId: session!.user.id, ...input },
      });
      if (error) throw error;
      return data.mealLog;
    },
  });
}

export type { ManualMealInput } from "@/lib/mealLogMutations";

/**
 * Direct insert, already confirmed - manual entries skip the draft round-trip.
 * mutationFn + optimistic update live in module-scope defaults
 * (lib/mealLogMutations) so paused offline mutations resume after a reload.
 */
export function useAddManualMealLog() {
  return useMutation<void, Error, ManualMealInput>({ mutationKey: ADD_MANUAL_MEAL_KEY });
}

export function useUpdateMealLog() {
  return useMutation<void, Error, MealUpdate>({ mutationKey: UPDATE_MEAL_KEY });
}

export function useDeleteMealLog() {
  return useMutation<void, Error, { row: Tables<"meal_logs"> }>({ mutationKey: DELETE_MEAL_KEY });
}

/** Confirm (or adjust) a draft row - a plain UPDATE by id, not a re-submit. */
export function useConfirmMealLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; edits?: TablesUpdate<"meal_logs"> }) => {
      const { error } = await supabase
        .from("meal_logs")
        .update({ ...input.edits, confirmed: true })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meal_logs"] });
      qc.invalidateQueries({ queryKey: ["daily_summary"] });
      qc.invalidateQueries({ queryKey: ["weekly_balance"] });
    },
  });
}

/** Discard an abandoned draft so unconfirmed rows don't silently pile up. */
export function useDiscardMealLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meal_logs"] }),
  });
}

/** Recent confirmed entries can be reused without another AI request. */
export function useRecentMeals() {
  const session = useSession();
  return useQuery({
    queryKey: ["meal_logs", "recent"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from("meal_logs").select("*").eq("confirmed", true).order("logged_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });
}

export function useRestoreMealLog() {
  return useMutation<void, Error, { row: Tables<"meal_logs"> }>({ mutationKey: RESTORE_MEAL_KEY });
}
