import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { validateWaterPreferences, type WaterPreferences } from "./waterUnits";
export const WATER_PREFERENCES_KEY = ["water_preferences", "write"] as const;
export const waterPreferenceQueryKey = (userId: string | undefined) => ["water_preferences", "v2", userId] as const;
export type PreferenceWrite = { user_id: string; preferences: WaterPreferences; updated_at: string };
export function latestWaterPreferences(confirmed: PreferenceWrite | null | undefined, pending: PreferenceWrite[]) {
  return pending.reduce<PreferenceWrite | null>((latest, input) => !latest || Date.parse(input.updated_at) >= Date.parse(latest.updated_at) ? input : latest, confirmed ?? null);
}
export function registerWaterPreferenceDefaults(qc: QueryClient) {
  qc.setMutationDefaults(WATER_PREFERENCES_KEY, {
    scope: { id: "water-preferences" },
    mutationFn: async (input: PreferenceWrite) => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id !== input.user_id) throw new Error("Sign in to the account that changed these containers to sync them.");
      const preferences = validateWaterPreferences(input.preferences);
      if (!Number.isFinite(Date.parse(input.updated_at))) throw new Error("Invalid preference date.");
      const confirmed = qc.getQueryData<PreferenceWrite | null>(waterPreferenceQueryKey(input.user_id));
      if (confirmed && Date.parse(confirmed.updated_at) > Date.parse(input.updated_at)) return;
      const { error } = await supabase.from("water_preferences").upsert({ user_id: input.user_id, preferences, updated_at: input.updated_at }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onMutate: async (input: PreferenceWrite) => {
      validateWaterPreferences(input.preferences);
      await qc.cancelQueries({ queryKey: waterPreferenceQueryKey(input.user_id) });
    },
    onSuccess: (_data, input) => {
      qc.setQueryData<PreferenceWrite | null>(waterPreferenceQueryKey(input.user_id), previous => latestWaterPreferences(previous, [input]));
    },
    onSettled: (_data, _error, input) => {
      if (qc.isMutating({ mutationKey: WATER_PREFERENCES_KEY }) === 1) void qc.invalidateQueries({ queryKey: waterPreferenceQueryKey(input.user_id) });
    },
  });
}
