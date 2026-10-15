"use client";

import { useSyncExternalStore } from "react";
import { useQuery, useMutation, useMutationState } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { WATER_PREFERENCES_KEY, waterPreferenceQueryKey, latestWaterPreferences, type PreferenceWrite } from "@/lib/waterPreferenceMutations";
import { validateWaterPreferences, parseWaterPreferences, type WaterPreferences } from "@/lib/waterUnits";

const EVENT = "kenko-water-preferences";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(EVENT, callback); };
}
export function useWaterPreferences(userId: string | undefined) {
  const key = userId ? `kenko-water-preferences:v1:${userId}` : null;
  const raw = useSyncExternalStore(subscribe, () => {
    try { return key ? localStorage.getItem(key) : null; } catch { return null; }
  }, () => null);
  const pending = useMutationState({
    filters: { mutationKey: WATER_PREFERENCES_KEY, status: "pending" },
    select: mutation => mutation.state.variables as PreferenceWrite,
  }).filter(input => input.user_id === userId);
  const remote = useQuery({ queryKey: waterPreferenceQueryKey(userId), enabled: !!userId && pending.length === 0, queryFn: async () => {
    const { data, error } = await supabase.from("water_preferences").select("user_id, preferences, updated_at").eq("user_id", userId!).maybeSingle();
    if (error) throw error;
    return data ? { ...data, preferences: validateWaterPreferences(data.preferences) } : null;
  } });
  const write = useMutation<void, Error, PreferenceWrite>({ mutationKey: WATER_PREFERENCES_KEY });
  function save(preferences: WaterPreferences) {
    preferences = validateWaterPreferences(preferences);
    if (!key) throw new Error("Sign in to save your containers.");
    try { localStorage.setItem(key, JSON.stringify(preferences)); }
    catch { throw new Error("Your browser could not save these preferences. Enable site storage and try again."); }
    window.dispatchEvent(new Event(EVENT));
    write.mutate({ user_id: userId!, preferences, updated_at: new Date().toISOString() });
  }
  return { preferences: latestWaterPreferences(remote.data, pending)?.preferences ?? parseWaterPreferences(raw), save, syncError: remote.error };
}
