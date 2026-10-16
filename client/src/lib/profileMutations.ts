import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { parseTargets, targetForm } from "./goals";
import { finiteNumber } from "./tracking";
import { localDateISO } from "./utils";
import type { Tables } from "./types";

export const PROFILE_WRITE_KEY = ["user_profile", "write"] as const;
type Targets = ReturnType<typeof parseTargets>;
export type ProfileWrite = Targets & { user_id: string; updated_at: string } & Partial<Pick<Tables<"user_profile">, "height_cm" | "birth_date" | "biological_sex" | "goal" | "activity_multiplier" | "weekly_rate_kg">>;

export function validateProfileWrite(input: ProfileWrite): ProfileWrite {
  for (const key of ["protein_pct", "carbs_pct", "fat_pct", "water_goal_ml", "fiber_goal_g"] as const) {
    if (typeof input[key] !== "number") throw new Error("Invalid target value.");
  }
  if (input.calorie_target_override !== null && typeof input.calorie_target_override !== "number") throw new Error("Invalid calorie target.");
  if (!input.user_id || !Number.isFinite(Date.parse(input.updated_at))) throw new Error("Invalid profile author or date.");
  const clean: ProfileWrite = { user_id: input.user_id, updated_at: input.updated_at, ...parseTargets(targetForm(input)) };
  if (input.height_cm !== undefined) clean.height_cm = input.height_cm === null ? null : finiteNumber(input.height_cm, "Height", true);
  if (input.activity_multiplier !== undefined) clean.activity_multiplier = finiteNumber(input.activity_multiplier, "Activity multiplier", true);
  if (input.weekly_rate_kg !== undefined) {
    if (input.weekly_rate_kg === null) clean.weekly_rate_kg = null;
    else { const rate = finiteNumber(input.weekly_rate_kg, "Weekly rate", true); if (rate > 1.5) throw new Error("Weekly rate must be 1.5 kg or less."); clean.weekly_rate_kg = rate; }
  }
  for (const [key, values] of [["biological_sex", ["male", "female"]], ["goal", ["cut", "maintain", "bulk"]]] as const) {
    if (input[key] !== undefined) {
      if (input[key] !== null && !values.includes(input[key] as never)) throw new Error(`Invalid ${key.replaceAll("_", " ")}.`);
      clean[key] = input[key];
    }
  }
  if (input.birth_date !== undefined) {
    const date = input.birth_date;
    if (date !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00`)) || localDateISO(new Date(`${date}T12:00:00`)) !== date || date > localDateISO())) throw new Error("Enter a valid birth date in the past.");
    clean.birth_date = date;
  }
  return clean;
}

/** Overlay queued values without changing the confirmed cache or inventing body data. */
export function mergeProfile(base: Tables<"user_profile"> | null | undefined, writes: ProfileWrite[]): Tables<"user_profile"> | null {
  if (!writes.length) return base ?? null;
  const defaults: Tables<"user_profile"> = { user_id: writes[0].user_id, updated_at: writes[0].updated_at, height_cm: null, birth_date: null, biological_sex: null, goal: null, activity_multiplier: 1.375, weekly_rate_kg: null, ...parseTargets(targetForm()) };
  return writes.reduce<Tables<"user_profile">>((row, input) => {
    const clean = validateProfileWrite(input);
    return Date.parse(row.updated_at) > Date.parse(clean.updated_at) ? row : { ...row, ...clean };
  }, base ?? defaults);
}

export function registerProfileDefaults(qc: QueryClient) {
  qc.setMutationDefaults(PROFILE_WRITE_KEY, {
    scope: { id: "profile-writes" },
    mutationFn: async (input: ProfileWrite) => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id !== input.user_id) throw new Error("Sign in to the account that changed these targets to sync them.");
      const clean = validateProfileWrite(input);
      // A failed old save can remain in the persisted retry queue after a newer
      // save succeeds. Never roll the confirmed local revision backwards.
      const confirmed = qc.getQueryData<Tables<"user_profile"> | null>(["user_profile", input.user_id]);
      if (confirmed && Date.parse(confirmed.updated_at) > Date.parse(input.updated_at)) return;
      const { error } = await supabase.from("user_profile").upsert(clean, { onConflict: "user_id" });
      if (error) throw error;
    },
    onMutate: async (input: ProfileWrite) => {
      validateProfileWrite(input);
      await qc.cancelQueries({ queryKey: ["user_profile", input.user_id] });
    },
    onSuccess: (_data, input) => {
      qc.setQueryData<Tables<"user_profile"> | null>(["user_profile", input.user_id], previous => previous && Date.parse(previous.updated_at) > Date.parse(input.updated_at) ? previous : mergeProfile(previous, [input]));
    },
    onSettled: (_data, _error, input) => {
      if (qc.isMutating({ mutationKey: PROFILE_WRITE_KEY }) === 1) {
        void qc.invalidateQueries({ queryKey: ["user_profile", input.user_id] });
        void qc.invalidateQueries({ queryKey: ["weekly_balance"] });
      }
    },
  });
}
