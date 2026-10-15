"use client";

import { matchesLibrarySearch } from "@/lib/librarySearch";
import { onlineManager } from "@tanstack/react-query";
import { useState } from "react";
import { Flame, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { parseRecipeDetails, type RecipeDetails } from "@/lib/recipe";
import RecipeCalculator from "@/components/RecipeCalculator";
import EmptyState from "@/components/EmptyState";
import { useAddDish, useDeleteDish, useDishes, useUpdateDish } from "@/hooks/useDishes";
import { convertLabelValue, finiteNumber, optionalNutrient, nutrientInputValue, formatNutrient, type NutritionBasis } from "@/lib/tracking";
import { errorMessage } from "@/lib/utils";

const EMPTY = {
  name: "",
  calories_per_100g: "",
  protein_g_per_100g: "",
  carbs_g_per_100g: "",
  fat_g_per_100g: "",
  fiber_g_per_100g: "",
  reference_serving_g: "",
};

type FormState = typeof EMPTY;

const NUTRITION_FIELDS = [
  ["calories_per_100g", "Calories / 100g"],
  ["protein_g_per_100g", "Protein g / 100g"],
  ["carbs_g_per_100g", "Carbs g / 100g"],
  ["fat_g_per_100g", "Fat g / 100g"],
  ["fiber_g_per_100g", "Fiber g / 100g"],
] as const;

function toInput(form: FormState, basis: NutritionBasis) {
  if (basis === "serving") finiteNumber(form.reference_serving_g, "Serving weight", true);
  const normalized = { ...form };
  for (const [key] of NUTRITION_FIELDS) normalized[key] = convertLabelValue(form[key], basis, "100g", form.reference_serving_g);
  form = normalized;
  return {
    name: form.name.trim(),
    calories_per_100g: Number(form.calories_per_100g),
    protein_g_per_100g: optionalNutrient(form.protein_g_per_100g, "Protein"),
    carbs_g_per_100g: optionalNutrient(form.carbs_g_per_100g, "Carbs"),
    fat_g_per_100g: optionalNutrient(form.fat_g_per_100g, "Fat"),
    fiber_g_per_100g: optionalNutrient(form.fiber_g_per_100g, "Fiber"),
    reference_serving_g: form.reference_serving_g ? Number(form.reference_serving_g) : null,
  };
}

export default function DishesPage() {
  const dishes = useDishes();
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const matching = (dishes.data ?? []).filter(dish => (!favoritesOnly || dish.is_favorite) && matchesLibrarySearch(search, dish.name));
  const add = useAddDish();
  const update = useUpdateDish();
  const del = useDeleteDish();
  const [basis, setBasis] = useState<NutritionBasis>("100g");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [recipe, setRecipe] = useState<RecipeDetails | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sourceNotes = dishes.data?.find(dish => dish.id === editingId)?.notes;
  const open = adding || editingId !== null;
  const pending = (add.isPending && !add.isPaused) || (update.isPending && !update.isPaused);

  function close() {
    setBasis("100g"); setFormError("");
    setRecipe(null);
    setForm(EMPTY);
    setCalculating(false);
    setAdding(false);
    setEditingId(null);
  }

  function startEdit(d: NonNullable<typeof dishes.data>[number]) {
    setBasis("100g"); setFormError("");
    setCalculating(false);
    setRecipe(parseRecipeDetails(d.recipe_details));
    setEditingId(d.id);
    setAdding(false);
    setForm({
      name: d.name,
      calories_per_100g: String(Number(d.calories_per_100g)),
      protein_g_per_100g: nutrientInputValue(d.protein_g_per_100g),
      carbs_g_per_100g: nutrientInputValue(d.carbs_g_per_100g),
      fat_g_per_100g: nutrientInputValue(d.fat_g_per_100g),
      fiber_g_per_100g: nutrientInputValue(d.fiber_g_per_100g),
      reference_serving_g: d.reference_serving_g ? String(Number(d.reference_serving_g)) : "",
    });
  }

  function submit() {
    try {
      const input = { ...toInput(form, basis), recipe_details: recipe };
      setFormError("");
      if (editingId) update.mutate({ id: editingId, edits: input }, { onSuccess: close });
      else add.mutate(input, { onSuccess: close });
      if (!onlineManager.isOnline()) close();
    } catch (e) { setFormError(errorMessage(e)); }
  }

  function changeBasis(next: NutritionBasis) {
    try {
      const converted = { ...form };
      for (const [key] of NUTRITION_FIELDS) converted[key] = convertLabelValue(form[key], basis, next, form.reference_serving_g);
      setForm(converted); setBasis(next); setFormError("");
    } catch (e) { setFormError(errorMessage(e)); }
  }

  return (
    <div className="space-y-5">
      <div className="pt-1">
        <h1 className="text-xl font-extrabold tracking-tight">My Dishes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Save the food you cook often. Set its nutrition and serving size once, then log it in a few taps.
        </p>
      </div>

      {!open && (
        <Button className="h-12 w-full rounded-full" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add dish
        </Button>
      )}

      {open && (
        <Card className="space-y-4 p-5">
          {sourceNotes && <details className="text-sm"><summary className="cursor-pointer font-semibold">Source and reference notes</summary><p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{sourceNotes}</p><p className="mt-2 text-xs text-muted-foreground">These notes describe the original reference. Nutrition edits below are your personal changes.</p></details>}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Dish name</Label>
              <Input
                id="name"
                className="h-11 rounded-xl"
                placeholder="e.g. Jollof rice with chicken"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <Button type="button" variant="secondary" aria-expanded={calculating} onClick={() => setCalculating(!calculating)}>{calculating ? "Close calculator" : "Calculate from ingredients"}</Button>
            {calculating && <RecipeCalculator initial={recipe} foods={(dishes.data ?? []).filter(d => d.id !== editingId)} onUse={(result, details) => {
              setBasis("100g"); setFormError("");
              setRecipe(details);
              setForm(previous => ({ ...previous, ...Object.fromEntries(Object.entries(result.per100g).map(([key, value]) => [key, result.missing.includes(key as (typeof result.missing)[number]) ? "" : String(value)])), reference_serving_g: String(result.servingGrams) }));
              setCalculating(false);
            }} />}
            {recipe && <p className="text-xs text-muted-foreground">Ingredient breakdown saved. Use the calculator to adjust it; editing nutrition directly removes the breakdown.</p>}
            <div className="space-y-1.5"><Label htmlFor="nutrition-basis">Nutrition on your label</Label><select id="nutrition-basis" className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={basis} onChange={e => changeBasis(e.target.value as NutritionBasis)}><option value="100g">Per 100 g</option><option value="serving">Per serving</option></select><p className="text-xs text-muted-foreground">For per-serving labels, enter the serving weight in grams below. Switching an existing entry converts its values.</p></div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <div className="grid grid-cols-2 gap-3">
              {NUTRITION_FIELDS.map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>{basis === "serving" ? label.replace("/ 100g", "/ serving") : label}</Label>
                  <Input
                    id={key}
                    className="h-11 rounded-xl"
                    type="number"
                    min="0" step="any"
                    placeholder={key === "calories_per_100g" ? "" : "Unknown"}
                    value={form[key]}
                    onChange={(e) => { setRecipe(null); setForm({ ...form, [key]: e.target.value }); }}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="serving">Serving weight (g{basis === "100g" ? ", optional" : ", required"})</Label>
                <Input
                  id="serving"
                  required={basis === "serving"}
                  className="h-11 rounded-xl"
                  type="number" min="0.01" step="any"
                  value={form.reference_serving_g}
                  onChange={(e) => { setRecipe(null); setForm({ ...form, reference_serving_g: e.target.value }); }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                className="h-11 flex-1 rounded-full"
                disabled={pending || !form.name || !form.calories_per_100g}
              >
                {editingId ? "Save changes" : "Save dish"}
              </Button>
              <Button type="button" variant="secondary" className="h-11 rounded-full" onClick={close}>
                Cancel
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 rounded-full"
                  disabled={del.isPending && !del.isPaused}
                  onClick={() => { del.mutate(editingId, { onSuccess: close }); if (!onlineManager.isOnline()) close(); }}
                >
                  Delete
                </Button>
              )}
            </div>
            {(add.isError || update.isError || del.isError) && (
              <p className="text-sm text-destructive">
                {errorMessage(add.error ?? update.error ?? del.error)}
              </p>
            )}
          </form>
        </Card>
      )}

      <section className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="dish-library-search">Find a dish or recipe</Label>
          <Input id="dish-library-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your saved foods" />
          <Button variant={favoritesOnly ? "default" : "secondary"} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>Favorites only</Button>
          {dishes.isSuccess && <p role="status" className="text-xs text-muted-foreground">{matching.length} of {dishes.data.length} saved foods</p>}
        </div>
        {dishes.isLoading && <p role="status">Loading dishes…</p>}
        {dishes.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(dishes.error)}</p>}
        {matching.map((d) => (
          <Card
            key={d.id}
            className="flex-row items-center justify-between p-4"
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startEdit(d); } }}
            onClick={() => startEdit(d)}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                <Flame className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{d.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(Number(d.calories_per_100g))} cal/100g · P{" "}
                  {formatNutrient(d.protein_g_per_100g)} · C {formatNutrient(d.carbs_g_per_100g)} · F{" "}
                  {formatNutrient(d.fat_g_per_100g)}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {d.reference_serving_g ? `${Number(d.reference_serving_g).toLocaleString(undefined, { maximumFractionDigits: 1 })} g / serving` : "Per 100 g"}
            </Badge>
          </Card>
        ))}
        {dishes.isSuccess && dishes.data.length > 0 && matching.length === 0 && <EmptyState>No foods match. Try another search or turn off the favorites filter.</EmptyState>}
        {dishes.isSuccess && dishes.data.length === 0 && (
          <EmptyState>No dishes yet — add the ones you actually eat on repeat.</EmptyState>
        )}
      </section>
    </div>
  );
}
