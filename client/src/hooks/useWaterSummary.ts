"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/Providers";
import { supabase } from "@/lib/supabase";

export function useWaterSummary(start: string, end: string) {
  const session = useSession();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return useQuery({
    queryKey: ["water_summary", session?.user.id, start, end, timezone],
    enabled: !!session,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("daily_water_summary", {
        p_user_id: session!.user.id, p_start: start, p_end: end, p_tz: timezone,
      });
      if (error) throw error;
      return data;
    },
  });
}
