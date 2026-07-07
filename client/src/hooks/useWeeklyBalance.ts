"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";

export function useWeeklyBalance() {
  const session = useSession();
  return useQuery({
    queryKey: ["weekly_balance"],
    enabled: !!session,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("weekly_energy_balance", {
        p_user_id: session!.user.id,
      });
      if (error) throw error;
      // set-returning function: one row
      return Array.isArray(data) ? data[0] : data;
    },
  });
}
