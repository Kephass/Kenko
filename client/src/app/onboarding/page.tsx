"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "@/components/Providers";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseTargets, targetForm } from "@/lib/goals";
import { PROFILE_WRITE_KEY, validateProfileWrite, type ProfileWrite } from "@/lib/profileMutations";
import { errorMessage } from "@/lib/utils";
import type { Tables } from "@/lib/types";

export default function OnboardingPage() {
  const profile = useProfile();
  if (profile.isPending) return <p role="status">Loading your targets…</p>;
  if (profile.isError) return <p role="alert">{errorMessage(profile.error)}</p>;
  return <TargetSetup initial={profile.data} />;
}

function TargetSetup({ initial }: { initial: Tables<"user_profile"> | null }) {
  const [form, setForm] = useState(() => targetForm(initial));
  const session = useSession();
  const router = useRouter();
  const [validationError, setValidationError] = useState("");
  const save = useMutation<void, Error, ProfileWrite>({
    mutationKey: PROFILE_WRITE_KEY,
  });
  function saveTargets() {
    try {
      if (!session) throw new Error("Sign in to save your targets.");
      const input = validateProfileWrite({ user_id: session.user.id, ...parseTargets(form), updated_at: new Date().toISOString() });
      setValidationError("");
      save.mutate(input, { onSuccess: () => router.push("/log") });
    } catch (error) { setValidationError(errorMessage(error)); }
  }
  return <div className="space-y-5">
    <header className="space-y-2 pt-3"><p className="text-sm font-semibold text-muted-foreground">Welcome to Kenko</p><h1 className="text-3xl font-extrabold tracking-tight">Make tracking yours.</h1><p className="text-sm text-muted-foreground">Choose the food and water targets you want to track. You can change them any time.</p></header>
    <form className="space-y-5" onSubmit={e => { e.preventDefault(); saveTargets(); }}>
      <Card className="space-y-4 p-5">
        <h2 className="font-bold">Your daily targets</h2>
        {([['calorie_target_override', 'Calories (optional)'], ['water_goal_ml', 'Water (ml)'], ['fiber_goal_g', 'Fiber (g)']] as const).map(([key, label]) => <div key={key} className="space-y-1.5"><Label htmlFor={`setup-${key}`}>{label}</Label><Input id={`setup-${key}`} type="number" min="0.1" step="any" required={key !== 'calorie_target_override'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}
        <p className="text-xs text-muted-foreground">These starting values are editable tracking defaults. Leaving calories blank uses estimated expenditure when available, otherwise 2,000 calories.</p>
      </Card>
      <details className="rounded-2xl border bg-card p-5"><summary className="cursor-pointer font-semibold">Adjust your macro split</summary><div className="mt-4 space-y-3">
        {([['protein_pct', 'Protein (%)'], ['carbs_pct', 'Carbohydrates (%)'], ['fat_pct', 'Fat (%)']] as const).map(([key, label]) => <div key={key} className="space-y-1.5"><Label htmlFor={`setup-${key}`}>{label}</Label><Input id={`setup-${key}`} required type="number" min="0.1" max="100" step="any" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}
        <p className="text-sm text-muted-foreground">Total: {Number(form.protein_pct) + Number(form.carbs_pct) + Number(form.fat_pct)}% of 100%</p>
      </div></details>
      <Button className="h-12 w-full rounded-full" disabled={save.isPending}>{save.isPaused ? "Saved on this device · waiting to sync" : save.isPending ? "Saving…" : "Save targets and log food"}</Button>
      {validationError && <p role="alert" className="text-sm text-destructive">{validationError}</p>}
      {save.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(save.error)}</p>}
      <p className="text-center text-sm"><Link href="/log" className="underline">Start logging with the current defaults</Link></p>
    </form>
  </div>;
}
