"use client";
import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/Providers";
import { supabase } from "@/lib/supabase";
import { deriveDailyGoals } from "@/lib/goals";
import { TARGET_SNAPSHOT_KEY, targetsOnDay, type TargetSnapshot } from "@/lib/targetSnapshots";
import { localDateISO } from "@/lib/utils";
import { useProfile } from "./useProfile";
import { useWeeklyBalance } from "./useWeeklyBalance";

export function useTargetHistory(start: string, end: string) {
  const session = useSession();
  const profile = useProfile();
  const balance = useWeeklyBalance();
  const today = localDateISO();
  const current = deriveDailyGoals(balance.data?.calories_out, profile.data);
  const history = useQuery({
    queryKey: ["daily_target_snapshots", session?.user.id, start, end],
    enabled: !!session,
    queryFn: async () => {
      // Page explicitly: the API's default row limit must not truncate busy histories.
      const rows: TargetSnapshot[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("daily_target_snapshots").select("*").eq("user_id", session!.user.id).gte("day", start).lte("day", end).order("observed_at").order("id").range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) return rows;
      }
    },
  });
  const { mutate } = useMutation<void, Error, TargetSnapshot>({ mutationKey: TARGET_SNAPSHOT_KEY });
  const attempted = useRef("");
  const serialized = JSON.stringify(current);
  const recorded = JSON.stringify(targetsOnDay(history.data, today));
  const ready = !profile.hasPendingWrites && profile.isSuccess && balance.isSuccess && !profile.isFetching && !balance.isFetching && history.isSuccess;
  useEffect(() => {
    if (!session || !ready || today < start || today > end || serialized === recorded) return;
    const signature = `${session.user.id}:${today}:${serialized}`;
    if (attempted.current === signature) return;
    attempted.current = signature;
    mutate({ id: crypto.randomUUID(), user_id: session.user.id, day: today, observed_at: new Date().toISOString(), goals: JSON.parse(serialized) });
  }, [session, ready, today, start, end, serialized, recorded, mutate]);
  return { ...history, current, forDay: (day: string) => day === today ? current : targetsOnDay(history.data, day) };
}
