"use client";

import { useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { onlineManager } from "@tanstack/react-query";
import Sheet from "@/components/Sheet";
import BinIcon, { SWALLOW_S } from "@/components/BinIcon";
import { toast } from "@/components/Toaster";
import { Segmented } from "@/components/Chips";
import MacroInputs from "@/components/MacroInputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeleteMealLog, useRestoreMealLog, useUpdateMealLog } from "@/hooks/useMealLogs";
import { MEAL_OPTIONS } from "@/lib/mealMeta";
import { smartFoodPoints } from "@/lib/points";
import { localDateTime, logTimestamp, nutrientInputValue, nutritionInput, type MealType } from "@/lib/tracking";
import type { Tables } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

type Meal = Tables<"meal_logs">;
// One decimal keeps scaled portions readable in the fields.
const tidy = (value: number | null) => nutrientInputValue(value == null ? null : Math.round(Number(value) * 10) / 10);

/** Edit or delete one diary entry. Mount with a `key` per meal. */
export default function MealEditSheet({ meal, open, onOpenChange }: { meal: Meal; open: boolean; onOpenChange: (open: boolean) => void }) {
  const update = useUpdateMealLog();
  const del = useDeleteMealLog();
  const restore = useRestoreMealLog();
  const [error, setError] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const bin = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  // True while the entry is being pulled into the bin.
  const [swallow, setSwallow] = useState(false);
  const [values, setValues] = useState(() => ({
    name: meal.raw_text_input ?? "",
    meal_type: (meal.meal_type ?? "uncategorized") as MealType,
    when: localDateTime(new Date(meal.logged_at)),
    calories: tidy(meal.calories),
    protein: tidy(meal.protein_g),
    carbs: tidy(meal.carbs_g),
    fat: tidy(meal.fat_g),
    fiber: tidy(meal.fiber_g),
  }));
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  function save() {
    try {
      const nutrition = nutritionInput(values);
      const edits = { ...nutrition, points: smartFoodPoints(nutrition), raw_text_input: values.name.trim() || null, logged_at: logTimestamp(values.when), meal_type: values.meal_type };
      setError("");
      const done = () => { onOpenChange(false); toast("Entry updated"); };
      update.mutate({ row: meal, edits }, { onSuccess: done });
      if (!onlineManager.isOnline()) done();
    } catch (e) { setError(errorMessage(e)); }
  }

  function remove() {
    if (swallow) return;
    setSwallow(true);
    const to = bin.current?.getBoundingClientRect();
    const rows = [...(body.current?.children ?? [])] as HTMLElement[];
    // Genie: rows leave bottom-first, each narrowing early and curving into the bin.
    rows.forEach((row, index) => {
      const from = row.getBoundingClientRect();
      const delay = SWALLOW_S * 0.16 + (rows.length - 1 - index) * 0.045;
      const duration = SWALLOW_S * 0.5;
      if (reduceMotion || !to) { animate(row, { opacity: 0 }, { duration: 0.3 }); return; }
      animate(row, {
        x: to.left + to.width / 2 - (from.left + from.width / 2),
        y: to.top + to.height / 2 - (from.top + from.height / 2),
        scaleX: 0.04,
        scaleY: 0.08,
        opacity: 0,
      }, {
        x: { duration, delay, ease: [0.7, 0, 0.84, 0.35] },
        y: { duration, delay, ease: [0.45, 0, 0.9, 0.55] },
        scaleX: { duration, delay, ease: [0.3, 0, 0.6, 1] },
        scaleY: { duration, delay, ease: [0.6, 0, 0.9, 0.4] },
        opacity: { duration: duration * 0.3, delay: delay + duration * 0.7, ease: "linear" },
      });
    });
    setTimeout(() => {
      del.mutate({ row: meal });
      onOpenChange(false);
      toast("Entry deleted", { label: "Undo", onClick: () => restore.mutate({ row: meal }) });
    }, SWALLOW_S * 1000);
  }

  return (
    <Sheet
      spill={swallow}
      open={open}
      onOpenChange={onOpenChange}
      title="Edit entry"
      footer={
        <div className="flex gap-2">
          <Button ref={bin} type="button" variant="destructive" size="lg" className="relative z-10 px-4" aria-label="Delete entry" onClick={remove}>
            <BinIcon open={swallow} className="size-5" />
          </Button>
          <Button size="lg" className="flex-1" disabled={swallow || (update.isPending && !update.isPaused)} onClick={save}>Save changes</Button>
        </div>
      }
    >
      <div ref={body} className="space-y-4">
        <Input aria-label="Food name" placeholder="Food name" value={values.name} onChange={(e) => set("name", e.target.value)} />
        <label className="flex items-baseline justify-center gap-2 rounded-3xl bg-muted/70 py-4 transition-[background-color,box-shadow] duration-200 focus-within:bg-card focus-within:ring-4 focus-within:ring-foreground/[0.06]">
          <input
            aria-label="Calories"
            className="w-40 bg-transparent text-right text-5xl font-extrabold tracking-tighter tabular-nums outline-none"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={values.calories}
            onChange={(e) => set("calories", e.target.value)}
          />
          <span className="w-16 text-base font-semibold text-muted-foreground">cal</span>
        </label>
        <MacroInputs values={values} onChange={set} />
        <Segmented label="Meal" options={MEAL_OPTIONS} value={values.meal_type as (typeof MEAL_OPTIONS)[number]["value"]} onChange={(value) => set("meal_type", value)} />
        <Input aria-label="Date and time" type="datetime-local" max={localDateTime()} value={values.when} onChange={(e) => set("when", e.target.value)} />
        {(error || update.isError || del.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(update.error || del.error)}</p>}
      </div>
    </Sheet>
  );
}
