"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Droplets, Flame, Leaf, LogOut, type LucideIcon } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import type { Tables } from "@/lib/types";
import { PROFILE_WRITE_KEY, validateProfileWrite, type ProfileWrite } from "@/lib/profileMutations";
import { parseTargets } from "@/lib/goals";
import { MACROS } from "@/lib/macros";
import { finiteNumber } from "@/lib/tracking";
import { errorMessage } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/Chips";
import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import { toast } from "@/components/Toaster";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";

// Local-timezone yyyy-mm-dd; toISOString() would shift the day across UTC.
function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TARGETS = [
  { key: "calorie_target_override", label: "Calories", hint: "Blank uses your estimate", unit: "cal", placeholder: "Auto", Icon: Flame, color: "text-foreground" },
  { key: "water_goal_ml", label: "Water", hint: "Per day", unit: "ml", placeholder: "", Icon: Droplets, color: "text-water" },
  { key: "fiber_goal_g", label: "Fiber", hint: "Per day", unit: "g", placeholder: "", Icon: Leaf, color: "text-fiber" },
] as const satisfies readonly { key: string; label: string; hint: string; unit: string; placeholder: string; Icon: LucideIcon; color: string }[];

const SEXES = [{ value: "male", label: "Male" }, { value: "female", label: "Female" }];
const GOALS = [{ value: "cut", label: "Lose" }, { value: "maintain", label: "Maintain" }, { value: "bulk", label: "Gain" }];
const PACES = [{ value: "0.25", label: "Gentle" }, { value: "0.5", label: "Standard" }, { value: "0.75", label: "Faster" }];
const ACTIVITY = [{ value: "1.2", label: "Sedentary" }, { value: "1.375", label: "Light" }, { value: "1.55", label: "Moderate" }];

const rise = (index: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.05 + index * 0.06 },
} as const);

export default function SettingsPage() {
  const profile = useProfile();
  if (profile.isPending) return (
    <div className="space-y-5" role="status">
      <span className="sr-only">Loading your settings…</span>
      <PageHeader title="Settings" />
      <Skeleton className="h-64 rounded-3xl" />
      <Skeleton className="h-44 rounded-3xl" />
      <Skeleton className="h-56 rounded-3xl" />
    </div>
  );
  if (profile.isError) return (
    <div className="space-y-5">
      <PageHeader title="Settings" />
      <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage(profile.error)}</p>
    </div>
  );
  return <ProfileForm initial={profile.data} />;
}

function Group({ title, hint, index, children }: { title: string; hint?: string; index: number; children: React.ReactNode }) {
  return (
    <motion.section {...rise(index)} className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Card className="gap-5 p-5">{children}</Card>
    </motion.section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ProfileForm({ initial }: { initial: Tables<"user_profile"> | null }) {
  const session = useSession();
  const [form, setForm] = useState(() => ({
    height_cm: initial?.height_cm?.toString() ?? "",
    birth_date: initial?.birth_date ?? "",
    biological_sex: initial?.biological_sex ?? "male",
    goal: initial?.goal ?? "maintain",
    weekly_rate_kg: initial?.weekly_rate_kg?.toString() ?? "0.5",
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
        weekly_rate_kg: form.goal === "maintain" ? null : Number(form.weekly_rate_kg),
        activity_multiplier: Number(form.activity_multiplier),
        updated_at: new Date().toISOString(),
      });
      setValidationError("");
      save.mutate(input, { onSuccess: () => toast("Saved") });
    } catch (error) { setValidationError(errorMessage(error)); }
  }

  const pct = { protein: Number(form.protein_pct) || 0, carbs: Number(form.carbs_pct) || 0, fat: Number(form.fat_pct) || 0 };
  const total = Math.round((pct.protein + pct.carbs + pct.fat) * 100) / 100;
  const balanced = Math.abs(total - 100) < 0.000001;
  const birthDate = form.birth_date ? new Date(`${form.birth_date}T00:00:00`) : undefined;
  const problem = validationError || (save.isError ? errorMessage(save.error) : "");

  return (
    <form className="space-y-6" noValidate onSubmit={(e) => { e.preventDefault(); saveProfile(); }}>
      <PageHeader title="Settings" subtitle="Targets and profile" />

      <Group title="Daily targets" index={0}>
        {TARGETS.map(({ key, label, hint, unit, placeholder, Icon, color }) => (
          <div key={key} className="flex items-center gap-3">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-full bg-current/10 ${color}`} aria-hidden="true">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <Label htmlFor={key} className="text-base font-semibold">{label}</Label>
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </div>
            <div className="relative w-32 shrink-0">
              <Input
                id={key}
                type="number"
                inputMode="decimal"
                min="0.1"
                step="any"
                placeholder={placeholder}
                className="pr-11 text-right text-lg font-bold tabular-nums"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-muted-foreground">{unit}</span>
            </div>
          </div>
        ))}
      </Group>

      <Group title="Macro split" hint="% of calories" index={1}>
        <div className="space-y-2">
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            {MACROS.map(({ key, colorClass }) => (
              <motion.span
                key={key}
                className={`h-full rounded-full bg-current ${colorClass}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(100, (pct[key] / Math.max(total, 100)) * 100))}%` }}
                transition={{ type: "spring", damping: 30, stiffness: 260 }}
              />
            ))}
          </div>
          <p
            role="status"
            className={`text-xs font-semibold tabular-nums ${balanced ? "text-muted-foreground" : "text-destructive"}`}
          >
            {balanced ? "Total 100%" : `Total ${total}% · ${total < 100 ? `add ${Math.round((100 - total) * 100) / 100}%` : `remove ${Math.round((total - 100) * 100) / 100}%`} to reach 100%`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {MACROS.map(({ key, label, colorClass }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`${key}_pct`} className="gap-1.5 text-xs font-semibold text-muted-foreground">
                <span className={`size-2 rounded-full bg-current ${colorClass}`} aria-hidden="true" />
                {label}
              </Label>
              <div className="relative">
                <Input
                  id={`${key}_pct`}
                  aria-label={`${key === "carbs" ? "Carbohydrates" : label} (%)`}
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step="any"
                  aria-invalid={!balanced || undefined}
                  className="pr-8 text-lg font-bold tabular-nums"
                  value={form[`${key}_pct`]}
                  onChange={(e) => setForm({ ...form, [`${key}_pct`]: e.target.value })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-semibold text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
      </Group>

      <Group title="About you" index={2}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="height" className="text-sm font-semibold">Height</Label>
            <div className="relative">
              <Input
                id="height"
                type="number"
                inputMode="decimal"
                className="pr-11 text-lg font-bold tabular-nums"
                value={form.height_cm}
                onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-muted-foreground">cm</span>
            </div>
          </div>
          <div className="space-y-2">
            <p id="birth-date-label" className="text-sm leading-none font-semibold">Birth date</p>
            <button
              type="button"
              aria-labelledby="birth-date-label birth-date-value"
              onClick={() => setDateOpen(true)}
              className="press flex h-12 w-full items-center justify-between gap-2 rounded-2xl bg-muted/70 px-4 text-left text-base"
            >
              <span id="birth-date-value" className={`truncate ${birthDate ? "font-semibold" : "text-muted-foreground/70"}`}>
                {birthDate ? birthDate.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "Select"}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </div>
        </div>
        <Field label="Biological sex" hint="For the BMR formula">
          <Segmented label="Biological sex" options={SEXES} value={form.biological_sex} onChange={(v) => setForm({ ...form, biological_sex: v })} />
        </Field>
        <Field label="Activity level" hint="Used without wearable data">
          <Segmented label="Activity level" options={ACTIVITY} value={form.activity_multiplier} onChange={(v) => setForm({ ...form, activity_multiplier: v })} />
        </Field>
      </Group>

      <Group title="Goal" index={3}>
        <Field label="Weight goal" hint="A manual calorie target overrides this">
          <Segmented label="Weight goal" options={GOALS} value={form.goal} onChange={(v) => setForm({ ...form, goal: v })} />
        </Field>
        <AnimatePresence initial={false}>
          {form.goal !== "maintain" && (
            <motion.div
              key="pace"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="-mx-1 overflow-hidden px-1"
            >
              <Field label={`Pace (${form.goal === "cut" ? "lose" : "gain"})`} hint={`${form.weekly_rate_kg} kg / week`}>
                <Segmented label={`Pace (${form.goal === "cut" ? "lose" : "gain"})`} options={PACES} value={form.weekly_rate_kg} onChange={(v) => setForm({ ...form, weekly_rate_kg: v })} />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>
      </Group>

      <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-20 space-y-2">
        <AnimatePresence>
          {problem && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="rounded-2xl bg-card px-4 py-3 text-sm font-medium text-destructive shadow-float ring-1 ring-destructive/20"
            >
              {problem}
            </motion.p>
          )}
        </AnimatePresence>
        <Button type="submit" size="lg" className="h-14 w-full shadow-float" disabled={save.isPending}>
          {save.isPaused ? "Saved on this device · waiting to sync" : save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <motion.div {...rise(4)}>
        <button
          type="button"
          className="press flex w-full items-center gap-3 rounded-3xl bg-card p-4 text-left text-destructive shadow-soft ring-1 ring-black/[0.04]"
          onClick={() => supabase.auth.signOut()}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10" aria-hidden="true">
            <LogOut className="size-4.5" />
          </span>
          <span className="flex-1 text-base font-semibold">Sign out</span>
          <ChevronRight className="size-4 opacity-50" />
        </button>
      </motion.div>

      <Sheet open={dateOpen} onOpenChange={setDateOpen} title="Birth date">
        <div className="flex justify-center">
          <Calendar
            className="bg-transparent p-0 [--cell-size:--spacing(10)]"
            mode="single"
            captionLayout="dropdown"
            selected={birthDate}
            defaultMonth={birthDate ?? new Date(1995, 0)}
            onSelect={(d) => {
              setForm({ ...form, birth_date: d ? toISODate(d) : "" });
              setDateOpen(false);
            }}
          />
        </div>
      </Sheet>
    </form>
  );
}
