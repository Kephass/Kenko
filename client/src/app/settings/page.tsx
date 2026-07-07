"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";

export default function SettingsPage() {
  const session = useSession();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["user_profile"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profile")
        .select("*")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    height_cm: "",
    birth_date: "",
    biological_sex: "male",
    goal: "maintain",
    activity_multiplier: "1.375",
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        height_cm: profile.data.height_cm?.toString() ?? "",
        birth_date: profile.data.birth_date ?? "",
        biological_sex: profile.data.biological_sex ?? "male",
        goal: profile.data.goal ?? "maintain",
        activity_multiplier: profile.data.activity_multiplier?.toString() ?? "1.375",
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_profile").upsert({
        user_id: session!.user.id,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        birth_date: form.birth_date || null,
        biological_sex: form.biological_sex,
        goal: form.goal,
        activity_multiplier: Number(form.activity_multiplier),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_profile"] });
      qc.invalidateQueries({ queryKey: ["weekly_balance"] });
    },
  });

  const input = "w-full rounded border px-3 py-2 dark:bg-neutral-900 dark:border-neutral-700";
  const label = "block text-sm font-medium mb-1";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-neutral-500">
        These feed the BMR and energy-balance calculations.
      </p>

      <div>
        <label className={label}>Height (cm)</label>
        <input
          className={input}
          type="number"
          value={form.height_cm}
          onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
        />
      </div>
      <div>
        <label className={label}>Birth date</label>
        <input
          className={input}
          type="date"
          value={form.birth_date}
          onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
        />
      </div>
      <div>
        <label className={label}>Biological sex (for the BMR formula)</label>
        <select
          className={input}
          value={form.biological_sex}
          onChange={(e) => setForm({ ...form, biological_sex: e.target.value })}
        >
          <option value="male">male</option>
          <option value="female">female</option>
        </select>
      </div>
      <div>
        <label className={label}>Goal</label>
        <select
          className={input}
          value={form.goal}
          onChange={(e) => setForm({ ...form, goal: e.target.value })}
        >
          <option value="cut">cut</option>
          <option value="maintain">maintain</option>
          <option value="bulk">bulk</option>
        </select>
      </div>
      <div>
        <label className={label}>Activity multiplier (fallback when no wearable data)</label>
        <select
          className={input}
          value={form.activity_multiplier}
          onChange={(e) => setForm({ ...form, activity_multiplier: e.target.value })}
        >
          <option value="1.2">1.2 - sedentary</option>
          <option value="1.375">1.375 - lightly active</option>
          <option value="1.55">1.55 - moderately active</option>
        </select>
      </div>

      <button
        className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Saving…" : "Save profile"}
      </button>
      {save.isSuccess && <p className="text-sm text-green-700 dark:text-green-400">Saved</p>}
      {save.isError && <p className="text-sm text-red-600">{String(save.error)}</p>}

      <hr className="dark:border-neutral-700" />
      <button className="text-sm text-neutral-500 underline" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  );
}
