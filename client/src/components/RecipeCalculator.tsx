"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateRecipe, type RecipeFood, type RecipeDetails } from "@/lib/recipe";
import { errorMessage } from "@/lib/utils";

type Result = ReturnType<typeof calculateRecipe>;
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
  return <fieldset className="space-y-4 rounded-xl border p-4">
    <legend className="px-1 text-sm font-semibold">Calculate from ingredients</legend>
    <p className="text-sm text-muted-foreground">Choose foods from your library, using weights that match their nutrition (raw or cooked). Weigh the finished batch separately.</p>
    {!foods.length && <p className="text-sm">Save your ingredient foods first, then return to build a recipe.</p>}
    {rows.map((row, index) => <div key={row.key} className="space-y-2 rounded-lg bg-muted/40 p-3">
      <Label htmlFor={`ingredient-${row.key}`}>Ingredient {index + 1}</Label>
      <select id={`ingredient-${row.key}`} className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={row.food?.id ?? ""} onChange={e => setRows(rows.map(r => r.key === row.key ? { ...r, food: foods.find(food => food.id === e.target.value) ?? null } : r))}>
        <option value="">Choose a food</option>
        {row.food && <option value={row.food.id}>{row.food.name}</option>}
        {foods.filter(food => food.id !== row.food?.id).map(food => <option key={food.id} value={food.id}>{food.name}</option>)}
      </select>
      <Label htmlFor={`ingredient-weight-${row.key}`}>Weight (g)</Label>
      <div className="flex gap-2">
        <Input id={`ingredient-weight-${row.key}`} type="number" min="0.01" step="any" value={row.grams} onChange={e => setRows(rows.map(r => r.key === row.key ? { ...r, grams: e.target.value } : r))} />
        <Button type="button" variant="ghost" aria-label={`Remove ingredient ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter(r => r.key !== row.key))}>Remove</Button>
      </div>
    </div>)}
    <Button type="button" variant="secondary" disabled={rows.length >= 100} onClick={() => { setRows([...rows, { key: nextKey, food: null, grams: "" }]); setNextKey(nextKey + 1); }}>Add ingredient</Button>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2"><Label htmlFor="recipe-yield">Finished batch (g)</Label><Input id="recipe-yield" type="number" min="0.01" step="any" value={yieldGrams} onChange={e => setYieldGrams(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="recipe-servings">Number of servings</Label><Input id="recipe-servings" type="number" min="0.01" step="any" value={servings} onChange={e => setServings(e.target.value)} /></div>
    </div>
    {result && <p role="status" className="text-sm font-medium">{Math.round(result.caloriesPerServing)} cal per serving · {Math.round(result.servingGrams * 10) / 10} g per serving</p>}
    {result && result.missing.length > 0 && <p className="text-sm text-muted-foreground">Some ingredients have missing nutrient values. Totals include only known values; check the calculated nutrition before saving.</p>}
    {submitted && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="button" onClick={() => { setSubmitted(true); if (result) onUse(result, { version: 1, ingredients: rows.map(row => ({ food: row.food!, grams: Number(row.grams) })), yieldGrams: Number(yieldGrams), servings: Number(servings) }); }}>Use calculated nutrition</Button>
    <p className="text-xs text-muted-foreground">Ingredients, their nutrition and the finished yield are saved with your dish. Later changes to source foods won’t change this recipe.</p>
  </fieldset>;
}
