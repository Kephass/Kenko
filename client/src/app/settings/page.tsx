"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import type { Tables } from "@/lib/types";
import { PROFILE_WRITE_KEY, validateProfileWrite, type ProfileWrite } from "@/lib/profileMutations";
import { parseTargets } from "@/lib/goals";
import { finiteNumber } from "@/lib/tracking";
import { errorMessage } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";

// Local-timezone yyyy-mm-dd; toISOString() would shift the day across UTC.
function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SettingsPage() {
  const profile = useProfile();
  if (profile.isPending) return <p role="status">Loading your settings…</p>;
  if (profile.isError) return <p role="alert" className="text-sm text-destructive">{errorMessage(profile.error)}</p>;
  return <ProfileForm initial={profile.data} />;
}

function ProfileForm({ initial }: { initial: Tables<"user_profile"> | null }) {
  const session = useSession();
  const [form, setForm] = useState(() => ({
    height_cm: initial?.height_cm?.toString() ?? "",
    birth_date: initial?.birth_date ?? "",
    biological_sex: initial?.biological_sex ?? "male",
    goal: initial?.goal ?? "maintain",
    activity_multiplier: initial?.activity_multiplier?.toString() ?? "1.375",
    calorie_target_override: initial?.calorie_target_override?.toString() ?? "",
    protein_pct: String(initial?.protein_pct ?? 30),
    carbs_pct: String(initial?.carbs_pct ?? 40),
    fat_pct: String(initial?.fat_pct ?? 30),
    water_goal_ml: String(initial?.water_goal_ml ?? 2000),
    fiber_goal_g: String(initial?.fiber_goal_g ?? 25),
  }));
  const [dateOpen, setDateOpen] = useState(false);

  const [validationError, setValidationError] = useState("");
  const save = useMutation<void, Error, ProfileWrite>({ mutationKey: PROFILE_WRITE_KEY });
  function saveProfile() {
    try {
      if (!session) throw new Error("Sign in to save your targets.");
      const input = validateProfileWrite({
        user_id: session.user.id,
        height_cm: form.height_cm ? finiteNumber(form.height_cm, "Height", true) : null,
        ...parseTargets(form),
        birth_date: form.birth_date || null,
        biological_sex: form.biological_sex,
        goal: form.goal,
        activity_multiplier: Number(form.activity_multiplier),
        updated_at: new Date().toISOString(),
      });
      setValidationError("");
      save.mutate(input);
    } catch (error) { setValidationError(errorMessage(error)); }
  }

  return (
    <div className="space-y-5">
      <div className="pt-1">
        <h1 className="text-xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set your daily food and water targets, and update your profile.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <h2 className="font-bold">Daily targets</h2>
        <p className="text-sm text-muted-foreground">Leave calories blank to use your estimated expenditure. Without enough profile and weight data, the starting target is 2,000 calories. These are editable tracking targets.</p>
        {([
          ["calorie_target_override", "Calories (optional)"],
          ["water_goal_ml", "Water (ml)"],
          ["fiber_goal_g", "Fiber (g)"],
          ["protein_pct", "Protein (%)"],
          ["carbs_pct", "Carbohydrates (%)"],
          ["fat_pct", "Fat (%)"],
        ] as const).map(([key, label]) => (
          <div className="space-y-1.5" key={key}>
            <Label htmlFor={key}>{label}</Label>
            <Input id={key} type="number" min="0.1" step="any" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}
        <p className="text-sm text-muted-foreground">Macro split: {Number(form.protein_pct) + Number(form.carbs_pct) + Number(form.fat_pct)}% of 100%</p>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="height">Height (cm)</Label>
          <Input
            id="height"
            className="h-11 rounded-xl"
            type="number"
            value={form.height_cm}
            onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Birth date</Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-11 w-full justify-between rounded-xl font-normal"
              >
                {form.birth_date
                  ? new Date(`${form.birth_date}T00:00:00`).toLocaleDateString([], {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Select date"}
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                captionLayout="dropdown"
                selected={form.birth_date ? new Date(`${form.birth_date}T00:00:00`) : undefined}
                defaultMonth={form.birth_date ? new Date(`${form.birth_date}T00:00:00`) : new Date(1995, 0)}
                onSelect={(d) => {
                  setForm({ ...form, birth_date: d ? toISODate(d) : "" });
                  setDateOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label>Biological sex (for the BMR formula)</Label>
          <Select
            value={form.biological_sex}
            onValueChange={(v) => setForm({ ...form, biological_sex: v })}
          >
            <SelectTrigger className="h-11 w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Weight goal</Label>
          <p className="text-xs text-muted-foreground">Saved to your profile. Set a calorie target above to change your daily budget.</p>
          <Select value={form.goal} onValueChange={(v) => setForm({ ...form, goal: v })}>
            <SelectTrigger className="h-11 w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cut">Lose weight</SelectItem>
              <SelectItem value="maintain">Maintain</SelectItem>
              <SelectItem value="bulk">Gain weight</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Activity level (fallback without wearable data)</Label>
          <Select
            value={form.activity_multiplier}
            onValueChange={(v) => setForm({ ...form, activity_multiplier: v })}
          >
            <SelectTrigger className="h-11 w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1.2">Sedentary</SelectItem>
              <SelectItem value="1.375">Lightly active</SelectItem>
              <SelectItem value="1.55">Moderately active</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Button className="h-12 w-full rounded-full" disabled={save.isPending} onClick={saveProfile}>
        {save.isPaused ? "Saved on this device · waiting to sync" : save.isPending ? "Saving…" : "Save profile"}
      </Button>
      {validationError && <p role="alert" className="text-sm text-destructive">{validationError}</p>}
      {save.isSuccess && <p className="text-center text-sm font-medium">Saved ✓</p>}
      {save.isError && <p className="text-sm text-destructive">{errorMessage(save.error)}</p>}

      <button
        className="w-full text-center text-sm text-muted-foreground underline"
        onClick={() => supabase.auth.signOut()}
      >
        Sign out
      </button>
    </div>
  );
}
