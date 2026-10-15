"use client";

import { useQuery, useMutationState } from "@tanstack/react-query";
import { useSession } from "@/components/Providers";
import { supabase } from "@/lib/supabase";

import { PROFILE_WRITE_KEY, mergeProfile, type ProfileWrite } from "@/lib/profileMutations";

export function useProfile() {
  const session = useSession();
  const pending = useMutationState({
    filters: { mutationKey: PROFILE_WRITE_KEY, status: "pending" },
    select: mutation => mutation.state.variables as ProfileWrite,
  }).filter(input => input.user_id === session?.user.id);
  const query = useQuery({
    queryKey: ["user_profile", session?.user.id],
    enabled: !!session && pending.length === 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_profile").select("*").eq("user_id", session!.user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return { ...query, data: mergeProfile(query.data, pending), hasPendingWrites: pending.length > 0 };
}
