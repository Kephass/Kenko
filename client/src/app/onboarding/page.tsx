"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronDown, Droplets, Flame, Leaf, type LucideIcon } from "lucide-react";
import { useSession } from "@/components/Providers";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { parseTargets, targetForm } from "@/lib/goals";
import { MACROS } from "@/lib/macros";
import { PROFILE_WRITE_KEY, validateProfileWrite, type ProfileWrite } from "@/lib/profileMutations";
import { errorMessage } from "@/lib/utils";
import type { Tables } from "@/lib/types";

const TARGETS = [
  { key: "calorie_target_override", label: "Calories", hint: "Optional · blank uses your estimate", unit: "cal", placeholder: "Auto", Icon: Flame, color: "text-foreground" },
  { key: "water_goal_ml", label: "Water", hint: "Per day", unit: "ml", placeholder: "", Icon: Droplets, color: "text-water" },
  { key: "fiber_goal_g", label: "Fiber", hint: "Per day", unit: "g", placeholder: "", Icon: Leaf, color: "text-fiber" },
] as const satisfies readonly { key: string; label: string; hint: string; unit: string; placeholder: string; Icon: LucideIcon; color: string }[];

const rise = (index: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.05 + index * 0.07 },
} as const);

export default function OnboardingPage() {
  const profile = useProfile();
  if (profile.isPending) return (
    <div className="space-y-5 pt-10" role="status">
      <span className="sr-only">Loading your targets…</span>
      <Skeleton className="h-5 w-32 rounded-full" />
      <Skeleton className="h-20 w-64" />
      <Skeleton className="h-72 rounded-3xl" />
      <Skeleton className="h-14 rounded-full" />
    </div>
  );
  if (profile.isError) return <p role="alert" className="mt-10 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage(profile.error)}</p>;
  return <TargetSetup initial={profile.data} />;
}

function TargetSetup({ initial }: { initial: Tables<"user_profile"> | null }) {
  const [form, setForm] = useState(() => targetForm(initial));
  const [macrosOpen, setMacrosOpen] = useState(false);
  const session = useSession();
  const router = useRouter();
  const [validationError, setValidationError] = useState("");
  const save = useMutation<void, Error, ProfileWrite>({
    mutationKey: PROFILE_WRITE_KEY,
  });
  const pct = { protein: Number(form.protein_pct) || 0, carbs: Number(form.carbs_pct) || 0, fat: Number(form.fat_pct) || 0 };
  const total = Math.round((pct.protein + pct.carbs + pct.fat) * 100) / 100;
  const balanced = Math.abs(total - 100) < 0.000001;

  function saveTargets() {
    try {
      if (!session) throw new Error("Sign in to save your targets.");
      const input = validateProfileWrite({ user_id: session.user.id, ...parseTargets(form), updated_at: new Date().toISOString() });
      setValidationError("");
      save.mutate(input, { onSuccess: () => router.push("/log") });
    } catch (error) {
      // Reveal the macro fields when they are what blocks saving.
      if (!balanced) setMacrosOpen(true);
      setValidationError(errorMessage(error));
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-8 pt-8">
      <motion.header {...rise(0)} className="space-y-3">
        <p className="inline-flex h-8 items-center rounded-full bg-card px-3.5 text-xs font-semibold text-muted-foreground shadow-soft ring-1 ring-black/[0.04]">Welcome to Kenko</p>
        <h1 className="text-5xl leading-[1.02] font-extrabold tracking-tight text-balance">Make tracking yours.</h1>
        <p className="text-base text-muted-foreground">Pick your daily targets. Change them any time.</p>
      </motion.header>

      <form className="flex flex-1 flex-col gap-4" noValidate onSubmit={e => { e.preventDefault(); saveTargets(); }}>
        <motion.div {...rise(1)}>
          <Card className="gap-0 divide-y divide-black/[0.05] p-0">
            <h2 className="sr-only">Your daily targets</h2>
            {TARGETS.map(({ key, label, hint, unit, placeholder, Icon, color }) => (
              <div key={key} className="flex items-center gap-3 px-5 py-4">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-full bg-current/10 ${color}`} aria-hidden="true">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`setup-${key}`} className="text-base font-semibold">{label}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
                </div>
                <div className="relative w-36 shrink-0">
                  <Input
                    id={`setup-${key}`}
                    type="number"
                    inputMode="decimal"
                    min="0.1"
                    step="any"
                    required={key !== "calorie_target_override"}
                    placeholder={placeholder}
                    className="h-14 pr-12 text-right text-2xl font-extrabold tabular-nums placeholder:font-semibold"
                    value={form[key]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-muted-foreground">{unit}</span>
                </div>
              </div>
            ))}
          </Card>
        </motion.div>

        <motion.div {...rise(2)}>
          <Card className="gap-0 p-0">
            <button
              type="button"
              aria-expanded={macrosOpen}
              aria-controls="setup-macros"
              onClick={() => setMacrosOpen(open => !open)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">Macro split</span>
                <span className={`mt-0.5 block text-xs tabular-nums ${balanced ? "text-muted-foreground" : "font-semibold text-destructive"}`}>
                  {balanced ? `Protein ${pct.protein}% · Carbs ${pct.carbs}% · Fat ${pct.fat}%` : `Total ${total}% · must be 100%`}
                </span>
              </span>
              <motion.span animate={{ rotate: macrosOpen ? 180 : 0 }} transition={{ type: "spring", damping: 24, stiffness: 300 }} className="flex size-8 items-center justify-center rounded-full bg-muted">
                <ChevronDown className="size-4" />
              </motion.span>
            </button>
            <div className="mx-5 mb-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
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
            <AnimatePresence initial={false}>
              {macrosOpen && (
                <motion.div
                  id="setup-macros"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-3 gap-3 px-5 pt-1 pb-5">
                    {MACROS.map(({ key, label, colorClass }) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`setup-${key}_pct`} className="gap-1.5 text-xs font-semibold text-muted-foreground">
                          <span className={`size-2 rounded-full bg-current ${colorClass}`} aria-hidden="true" />
                          {label}
                        </Label>
                        <div className="relative">
                          <Input
                            id={`setup-${key}_pct`}
                            aria-label={`${key === "carbs" ? "Carbohydrates" : label} (%)`}
                            required
                            type="number"
                            inputMode="decimal"
                            min="0.1"
                            max="100"
                            step="any"
                            aria-invalid={!balanced || undefined}
                            className="pr-8 text-lg font-bold tabular-nums"
                            value={form[`${key}_pct`]}
                            onChange={e => setForm({ ...form, [`${key}_pct`]: e.target.value })}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-semibold text-muted-foreground">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        <motion.div {...rise(3)} className="mt-auto space-y-2 pt-6">
          {validationError && <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{validationError}</p>}
          {save.isError && <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{errorMessage(save.error)}</p>}
          <Button size="lg" className="h-14 w-full" disabled={save.isPending}>
            {save.isPaused ? "Saved on this device · waiting to sync" : save.isPending ? "Saving…" : <>Save and start logging<ArrowRight className="size-5" /></>}
          </Button>
          <Button asChild variant="ghost" size="lg" className="w-full text-muted-foreground">
            <Link href="/log">Skip for now</Link>
          </Button>
        </motion.div>
      </form>
    </div>
  );
}
