"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";
import { todayStart } from "@/lib/utils";

export function useTodayMealLogs() {
  return useQuery({
    queryKey: ["meal_logs", "today"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_logs")
        .select("*")
        .gte("logged_at", todayStart())
        .order("logged_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Consecutive days with a confirmed log; today counts if logged, else counted from yesterday. */
export function useLogStreak() {
  return useQuery({
    queryKey: ["meal_logs", "streak"],
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data, error } = await supabase
        .from("meal_logs")
        .select("logged_at")
        .eq("confirmed", true)
        .gte("logged_at", since.toISOString());
      if (error) throw error;
      const days = new Set(data.map((r) => new Date(r.logged_at).toDateString()));
      let streak = 0;
      const cur = new Date();
      if (!days.has(cur.toDateString())) cur.setDate(cur.getDate() - 1);
      while (days.has(cur.toDateString())) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      }
      return streak;
    },
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

/** Confirm (or adjust) a draft row - a plain UPDATE by id, not a re-submit. */
export function useConfirmMealLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; edits?: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("meal_logs")
        .update({ ...input.edits, confirmed: true })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meal_logs"] });
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
