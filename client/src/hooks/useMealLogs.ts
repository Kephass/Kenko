"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

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
