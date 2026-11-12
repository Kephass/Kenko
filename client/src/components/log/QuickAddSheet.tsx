"use client";

import { useState } from "react";
import { ShoppingBasket } from "lucide-react";
import Sheet from "@/components/Sheet";
import Stepper from "@/components/Stepper";
import MacroInputs from "@/components/MacroInputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nutritionInput, repeatNutrition, repeatedFoodName } from "@/lib/tracking";
import type { Tables } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

export type QuickEntry = { name: string; values: Record<string, string>; points?: number | null };
/** Scaled values rounded to one decimal so the fields stay readable. */
function scaled(meal: Tables<"meal_logs">, portions: string) {
  const values = repeatNutrition(meal, portions);
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === "" ? "" : String(Math.round(Number(value) * 10) / 10)]));
}
const EMPTY = { calories: "", protein: "", carbs: "", fat: "", fiber: "" };

/** Type calories directly, or re-log a previous entry at a new portion. */
export default function QuickAddSheet({ repeat, repeatName, open, onOpenChange, mealLabel, basketCount, onLog, onAdd }: {
  repeat?: Tables<"meal_logs">;
  repeatName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealLabel: string;
  basketCount: number;
  onLog: (entry: QuickEntry) => void;
  onAdd: (entry: QuickEntry) => void;
}) {
  const [name, setName] = useState(repeatName ?? "");
  const [values, setValues] = useState<Record<string, string>>(() => (repeat ? scaled(repeat, "1") : EMPTY));
  // Scaling stays linked to the original until a number is edited by hand.
  const [linked, setLinked] = useState(!!repeat);
  const [portions, setPortions] = useState("1");
  const [error, setError] = useState("");

  function scale(next: string) {
    setPortions(next);
    if (!repeat) return;
    try { setValues(scaled(repeat, next)); setError(""); } catch { /* Shown on submit. */ }
  }
  function entry(): QuickEntry | null {
    try {
      if (!name.trim()) throw new Error("Give this food a name.");
      nutritionInput(values);
      const scaled = linked && repeat;
      if (scaled) repeatNutrition(repeat, portions);
      setError("");
      return { name: scaled ? repeatedFoodName(name, portions) : name.trim(), values, points: scaled && repeat.points === 0 ? 0 : undefined };
    } catch (e) { setError(errorMessage(e)); return null; }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={repeat ? "Log again" : "Quick add"}
      description={repeat ? "Same as last time, or adjust the portion." : "Straight from a label or your own estimate."}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="lg" className="px-4" disabled={basketCount >= 100} aria-label="Add to a meal you are building" onClick={() => { const value = entry(); if (value) onAdd(value); }}>
            <ShoppingBasket className="size-5" />
            {basketCount > 0 && <span className="tabular-nums">{basketCount}</span>}
          </Button>
          <Button type="button" size="lg" className="flex-1" onClick={() => { const value = entry(); if (value) onLog(value); }}>Log to {mealLabel}</Button>
        </div>
      }
    >
      <Input aria-label="Food or meal name" placeholder="What did you eat?" value={name} onChange={(e) => setName(e.target.value)} />
      {repeat && linked && <Stepper label="Portions" unit="×" value={portions} onChange={scale} step={0.5} min={0} />}
      <label className="flex items-baseline justify-center gap-2 rounded-3xl bg-muted/70 py-4 transition-[background-color,box-shadow] duration-200 focus-within:bg-card focus-within:ring-4 focus-within:ring-foreground/[0.06]">
        <input
          aria-label="Calories"
          className="w-40 bg-transparent text-right text-5xl font-extrabold tracking-tighter tabular-nums outline-none placeholder:text-muted-foreground/30"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          placeholder="0"
          autoFocus={!repeat}
          value={values.calories}
          onChange={(e) => { setLinked(false); setValues((current) => ({ ...current, calories: e.target.value })); }}
        />
        <span className="w-16 text-base font-semibold text-muted-foreground">cal</span>
      </label>
      <MacroInputs values={values} onChange={(key, value) => { setLinked(false); setValues((current) => ({ ...current, [key]: value })); }} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </Sheet>
  );
}
