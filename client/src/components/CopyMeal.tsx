"use client";

import { useState } from "react";
import { useMutation, onlineManager } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Copy } from "lucide-react";
import { useSession } from "./Providers";
import Sheet from "./Sheet";
import { toast } from "./Toaster";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useWriteSavedMeal } from "@/hooks/useSavedMeals";
import { saveMealSnapshot } from "@/lib/savedMeals";
import { COPY_MEAL_KEY, makeMealCopy, type MealCopy } from "@/lib/copyMeal";
import { MEAL_META } from "@/lib/mealMeta";
import { initialLogTime, localDateTime, type MealType } from "@/lib/tracking";
import { localDateISO, errorMessage } from "@/lib/utils";
import type { Tables } from "@/lib/types";

/** Sheet with the two whole-meal actions: save as a template, or copy elsewhere. */
export default function CopyMeal({ rows, type, open, onOpenChange }: { rows: Tables<"meal_logs">[]; type: MealType; open: boolean; onOpenChange: (open: boolean) => void }) {
  const session = useSession();
  const router = useRouter();
  const saved = useWriteSavedMeal();
  const copy = useMutation<void, Error, MealCopy>({ mutationKey: COPY_MEAL_KEY });
  const [name, setName] = useState("");
  const [when, setWhen] = useState(() => initialLogTime(localDateISO()));
  const [error, setError] = useState("");
  const count = `${rows.length} ${rows.length === 1 ? "food" : "foods"}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={MEAL_META[type].label} description={`${count} · ${Math.round(rows.reduce((sum, row) => sum + Number(row.calories), 0))} cal`}>
      <form className="space-y-3 rounded-3xl bg-muted/50 p-4" onSubmit={(e) => {
        e.preventDefault();
        try {
          if (!session) throw new Error("Sign in to save a meal.");
          const row = saveMealSnapshot(rows, session.user.id, name, type);
          setError("");
          const done = () => { onOpenChange(false); setName(""); toast(`Saved “${row.name}”`, { label: "View", onClick: () => router.push("/meals") }); };
          saved.mutate({ operation: "add", row }, { onSuccess: done });
          if (!onlineManager.isOnline()) done();
        } catch (e) { setError(errorMessage(e)); }
      }}>
        <p className="flex items-center gap-2 text-sm font-bold"><BookmarkPlus className="size-4" />Save as a meal</p>
        <Input className="bg-card" aria-label="Meal name" required maxLength={120} placeholder="e.g. My usual breakfast" value={name} onChange={(e) => setName(e.target.value)} />
        <Button className="w-full" disabled={saved.isPending && !saved.isPaused}>Save {count}</Button>
      </form>
      <form className="space-y-3 rounded-3xl bg-muted/50 p-4" onSubmit={(e) => {
        e.preventDefault();
        try {
          if (!session) throw new Error("Sign in to copy a meal.");
          const input = makeMealCopy(rows, session.user.id, when, type);
          setError("");
          const destination = when.slice(0, 10);
          const done = () => { onOpenChange(false); toast("Meal copied", { label: "Open day", onClick: () => router.push(`/?date=${destination}`) }); };
          copy.mutate(input, { onSuccess: done });
          if (!onlineManager.isOnline()) done();
        } catch (e) { setError(errorMessage(e)); }
      }}>
        <p className="flex items-center gap-2 text-sm font-bold"><Copy className="size-4" />Copy to another time</p>
        <Input className="bg-card" aria-label="Date and time for the copy" required type="datetime-local" max={localDateTime()} value={when} onChange={(e) => setWhen(e.target.value)} />
        <Button variant="secondary" className="w-full bg-card" disabled={copy.isPending && !copy.isPaused}>Copy {count}</Button>
      </form>
      {(error || copy.isError || saved.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(copy.error ?? saved.error)}</p>}
    </Sheet>
  );
}
