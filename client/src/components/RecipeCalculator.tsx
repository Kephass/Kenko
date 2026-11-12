"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateRecipe, type RecipeFood, type RecipeDetails } from "@/lib/recipe";
import { errorMessage } from "@/lib/utils";

type Result = ReturnType<typeof calculateRecipe>;

const fieldLabel = "text-xs font-medium text-muted-foreground";
const field = "bg-card focus-visible:bg-card";

export default function RecipeCalculator({ foods, initial, onUse }: { foods: RecipeFood[]; initial: RecipeDetails | null; onUse: (result: Result, recipe: RecipeDetails) => void }) {
  const [rows, setRows] = useState<{ key: number; food: RecipeFood | null; grams: string }[]>(() => initial ? initial.ingredients.map((item, key) => ({ key, food: item.food, grams: String(item.grams) })) : [{ key: 0, food: null, grams: "" }]);
  const [nextKey, setNextKey] = useState(initial?.ingredients.length ?? 1);
  const [yieldGrams, setYieldGrams] = useState(initial ? String(initial.yieldGrams) : "");
  const [servings, setServings] = useState(initial ? String(initial.servings) : "1");
  const [submitted, setSubmitted] = useState(false);
  let result: Result | null = null;
  let error = "";
  try {
    result = calculateRecipe(rows.map(row => {
      const food = row.food;
      if (!food) throw new Error("Choose a saved food for each ingredient.");
      return { food, grams: row.grams };
    }), yieldGrams, servings);
  } catch (e) { error = errorMessage(e); }
  return (
    <fieldset className="min-w-0 space-y-4">
      <legend className="sr-only">Calculate from ingredients</legend>
      <p className="text-xs text-muted-foreground">Weigh ingredients as their nutrition is listed (raw or cooked), then the finished batch.</p>
      {!foods.length && <p className="text-sm">Save your ingredient foods first, then return to build a recipe.</p>}

      <div className="space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((row, index) => (
            <motion.div
              key={row.key}
              layout="position"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <div className="min-w-0 flex-1">
                <Label htmlFor={`ingredient-${row.key}`} className="sr-only">Ingredient {index + 1}</Label>
                <select
                  id={`ingredient-${row.key}`}
                  className={`h-12 w-full min-w-0 rounded-2xl border border-transparent bg-card px-4 text-base outline-none transition-shadow focus-visible:ring-4 focus-visible:ring-foreground/[0.06] ${row.food ? "" : "text-muted-foreground"}`}
                  value={row.food?.id ?? ""}
                  onChange={e => setRows(rows.map(r => r.key === row.key ? { ...r, food: foods.find(food => food.id === e.target.value) ?? null } : r))}
                >
                  <option value="">Choose a food</option>
                  {row.food && <option value={row.food.id}>{row.food.name}</option>}
                  {foods.filter(food => food.id !== row.food?.id).map(food => <option key={food.id} value={food.id}>{food.name}</option>)}
                </select>
              </div>
              <div className="relative w-24 shrink-0">
                <Label htmlFor={`ingredient-weight-${row.key}`} className="sr-only">Weight (g)</Label>
                <Input id={`ingredient-weight-${row.key}`} className={`${field} pr-8 tabular-nums`} type="number" inputMode="decimal" min="0.01" step="any" placeholder="0" value={row.grams} onChange={e => setRows(rows.map(r => r.key === row.key ? { ...r, grams: e.target.value } : r))} />
                <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-muted-foreground">g</span>
              </div>
              <button
                type="button"
                className="press flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground disabled:opacity-30"
                aria-label={`Remove ingredient ${index + 1}`}
                disabled={rows.length === 1}
                onClick={() => setRows(rows.filter(r => r.key !== row.key))}
              >
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Button type="button" variant="ghost" size="sm" className="bg-card" disabled={rows.length >= 100} onClick={() => { setRows([...rows, { key: nextKey, food: null, grams: "" }]); setNextKey(nextKey + 1); }}>
        <Plus /> Add ingredient
      </Button>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="recipe-yield" className={fieldLabel}>Finished batch (g)</Label><Input id="recipe-yield" className={field} type="number" inputMode="decimal" min="0.01" step="any" value={yieldGrams} onChange={e => setYieldGrams(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="recipe-servings" className={fieldLabel}>Number of servings</Label><Input id="recipe-servings" className={field} type="number" inputMode="decimal" min="0.01" step="any" value={servings} onChange={e => setServings(e.target.value)} /></div>
      </div>

      {result && (
        <p role="status" className="flex items-end justify-around rounded-2xl bg-card px-4 py-3 text-center">
          <span>
            <span className="block text-2xl font-extrabold tabular-nums">{Math.round(result.caloriesPerServing)}</span>
            <span className="block text-xs text-muted-foreground">cal per serving</span>
          </span>
          <span>
            <span className="block text-2xl font-extrabold tabular-nums">{Math.round(result.servingGrams * 10) / 10}</span>
            <span className="block text-xs text-muted-foreground">g per serving</span>
          </span>
        </p>
      )}
      {result && result.missing.length > 0 && <p className="text-xs text-muted-foreground">Some ingredients have missing nutrient values. Totals include only known values; check them before saving.</p>}
      {submitted && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="button" className="w-full" onClick={() => { setSubmitted(true); if (result) onUse(result, { version: 1, ingredients: rows.map(row => ({ food: row.food!, grams: Number(row.grams) })), yieldGrams: Number(yieldGrams), servings: Number(servings) }); }}>Use calculated nutrition</Button>
      <p className="text-xs text-muted-foreground">Saved with your dish; later changes to source foods won’t change it.</p>
    </fieldset>
  );
}
