"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";

export type MeasurementType = "waist" | "hip" | "chest" | "neck" | "thigh" | "arm";

export function useMeasurements() {
  return useQuery({
    queryKey: ["measurements"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("*")
        .order("logged_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useLatestMeasurement() {
  return useQuery({
    queryKey: ["measurements", "latest"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("measurement_type, value_cm, logged_at")
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useAddMeasurement() {
  const qc = useQueryClient();
  const session = useSession();
  return useMutation({
    mutationFn: async (input: { measurement_type: MeasurementType; value_cm: number }) => {
      const { error } = await supabase
        .from("measurements")
        .insert({ user_id: session!.user.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurements"] });
      qc.invalidateQueries({ queryKey: ["body_fat"] });
    },
  });
}

/** Navy-method estimate from latest waist/neck(/hip) + profile height; null until those exist. */
export function useBodyFat() {
  const session = useSession();
  return useQuery({
    queryKey: ["body_fat"],
    enabled: !!session,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("latest_body_fat_estimate", {
        p_user_id: session!.user.id,
      });
      if (error) throw error;
      return data as number | null;
    },
  });
}
