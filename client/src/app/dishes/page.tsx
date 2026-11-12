"use client";

import { useState } from "react";
import { onlineManager, useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Calculator, ChevronDown, Flame, Plus, Search, Star, Trash2, UtensilsCrossed } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip, Segmented } from "@/components/Chips";
import PageHeader from "@/components/PageHeader";
import RecipeCalculator from "@/components/RecipeCalculator";
import Sheet from "@/components/Sheet";
import { toast } from "@/components/Toaster";
import { useAddDish, useDeleteDish, useDishes, useUpdateDish } from "@/hooks/useDishes";
import { DISH_WRITE_KEY, type DishWrite } from "@/lib/dishMutations";
import { matchesLibrarySearch } from "@/lib/librarySearch";
import { parseRecipeDetails, type RecipeDetails } from "@/lib/recipe";
import { convertLabelValue, finiteNumber, formatNutrient, nutrientInputValue, optionalNutrient, type NutritionBasis } from "@/lib/tracking";
import type { Tables } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

type Dish = Tables<"dishes">;

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

const NUTRITION_KEYS = ["calories_per_100g", "protein_g_per_100g", "carbs_g_per_100g", "fat_g_per_100g", "fiber_g_per_100g"] as const;

const MACRO_FIELDS = [
  ["protein_g_per_100g", "Protein", "bg-protein"],
  ["carbs_g_per_100g", "Carbs", "bg-carbs"],
  ["fat_g_per_100g", "Fat", "bg-fat"],
  ["fiber_g_per_100g", "Fiber", "bg-fiber"],
] as const;

const BASIS_OPTIONS = [
  { value: "100g", label: "Per 100 g" },
  { value: "serving", label: "Per serving" },
] as const;

const PAGE_SIZE = 50;
const fieldLabel = "text-xs font-medium text-muted-foreground";

function toInput(form: FormState, basis: NutritionBasis) {
  if (basis === "serving") finiteNumber(form.reference_serving_g, "Serving weight", true);
  const normalized = { ...form };
  for (const key of NUTRITION_KEYS) normalized[key] = convertLabelValue(form[key], basis, "100g", form.reference_serving_g);
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

// Re-adding only restores editable fields, so undo is offered for plain custom dishes.
const canRestore = (dish: Dish) => dish.source === "custom_recipe" && !dish.name_local && !dish.embedding;

const gramsOrDash = (value: number | null) => (value == null ? "–" : formatNutrient(value));

/** Runs a completion callback once, whether it fires offline or on sync. */
function once(run: () => void) {
  let ran = false;
  return () => {
    if (ran) return;
    ran = true;
    run();
  };
}

export default function DishesPage() {
  const dishes = useDishes();
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const matching = (dishes.data ?? []).filter(dish => (!favoritesOnly || dish.is_favorite) && matchesLibrarySearch(search, dish.name));
  const visible = matching.slice(0, limit);
  const add = useAddDish();
  const update = useUpdateDish();
  const favorite = useUpdateDish();
  const del = useDeleteDish();
  const restore = useMutation<void, Error, DishWrite>({ mutationKey: DISH_WRITE_KEY });
  const [basis, setBasis] = useState<NutritionBasis>("100g");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [recipe, setRecipe] = useState<RecipeDetails | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const open = adding || editing !== null;
  const pending = (add.isPending && !add.isPaused) || (update.isPending && !update.isPaused);
  const per = basis === "serving" ? "per serving" : "per 100 g";

  function close() {
    setBasis("100g"); setFormError("");
    setRecipe(null);
    setForm(EMPTY);
    setCalculating(false);
    setAdding(false);
    setEditing(null);
    setConfirmingDelete(false);
  }

  function startEdit(d: Dish) {
    setBasis("100g"); setFormError("");
    setCalculating(false);
    setConfirmingDelete(false);
    setRecipe(parseRecipeDetails(d.recipe_details));
    setEditing(d);
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
      const done = once(() => { close(); toast(editing ? "Changes saved" : "Dish saved"); });
      if (editing) update.mutate({ id: editing.id, edits: input }, { onSuccess: done });
      else add.mutate(input, { onSuccess: done });
      if (!onlineManager.isOnline()) done();
    } catch (e) { setFormError(errorMessage(e)); }
  }

  function changeBasis(next: NutritionBasis) {
    try {
      const converted = { ...form };
      for (const key of NUTRITION_KEYS) converted[key] = convertLabelValue(form[key], basis, next, form.reference_serving_g);
      setForm(converted); setBasis(next); setFormError("");
    } catch (e) { setFormError(errorMessage(e)); }
  }

  function remove(dish: Dish) {
    const undoable = canRestore(dish);
    if (!undoable && !confirmingDelete) { setConfirmingDelete(true); return; }
    const undo = () => restore.mutate({
      operation: "add", id: dish.id, user_id: dish.user_id, created_at: dish.created_at,
      edits: {
        name: dish.name,
        calories_per_100g: Number(dish.calories_per_100g),
        protein_g_per_100g: dish.protein_g_per_100g,
        carbs_g_per_100g: dish.carbs_g_per_100g,
        fat_g_per_100g: dish.fat_g_per_100g,
        fiber_g_per_100g: dish.fiber_g_per_100g,
        reference_serving_g: dish.reference_serving_g,
        is_favorite: dish.is_favorite,
        recipe_details: parseRecipeDetails(dish.recipe_details),
        notes: dish.notes,
      },
    });
    const done = once(() => {
      close();
      toast(`Deleted “${dish.name}”`, undoable ? { label: "Undo", onClick: undo } : undefined);
    });
    del.mutate(dish.id, { onSuccess: done });
    if (!onlineManager.isOnline()) done();
  }

  const setField = (key: keyof FormState, value: string) => { setRecipe(null); setForm({ ...form, [key]: value }); };

  return (
    <div className="space-y-5">
      <PageHeader
        title="My dishes"
        subtitle="Foods you eat on repeat."
        action={<Button onClick={() => setAdding(true)}><Plus /> Add dish</Button>}
      />

      <div className="space-y-3">
        <div className="relative">
          <Label htmlFor="dish-library-search" className="sr-only">Find a dish or recipe</Label>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="dish-library-search"
            type="search"
            className="bg-card pl-12 shadow-soft"
            value={search}
            onChange={e => { setSearch(e.target.value); setLimit(PAGE_SIZE); }}
            placeholder="Search dishes"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Chip selected={favoritesOnly} onClick={() => { setFavoritesOnly(!favoritesOnly); setLimit(PAGE_SIZE); }}>
            <Star className={`size-4 ${favoritesOnly ? "fill-current" : ""}`} /> Favorites
          </Chip>
          {dishes.isSuccess && <p role="status" className="text-xs text-muted-foreground tabular-nums">{matching.length} of {dishes.data.length}</p>}
        </div>
      </div>

      {dishes.isLoading && (
        <div role="status">
          <span className="sr-only">Loading dishes…</span>
          <Card className="gap-0 p-0">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </Card>
        </div>
      )}
      {dishes.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(dishes.error)}</p>}
      {(favorite.isError || restore.isError) && <p role="alert" className="text-sm text-destructive">{errorMessage(favorite.error ?? restore.error)}</p>}

      {visible.length > 0 && (
        <Card className="relative gap-0 p-0">
          <ul className="divide-y divide-black/[0.05]">
            <AnimatePresence mode="popLayout">
              {visible.map((d, index) => (
                <motion.li
                  key={d.id}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.025 }}
                  className="flex items-center bg-card"
                >
                  <button type="button" className="press flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 text-left" onClick={() => startEdit(d)}>
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-carbs/15 text-carbs">
                      <Flame className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{d.name}</span>
                      <span className="block truncate text-xs text-muted-foreground tabular-nums">
                        <span className="font-semibold text-protein">P</span> {gramsOrDash(d.protein_g_per_100g)}
                        {" · "}<span className="font-semibold text-carbs">C</span> {gramsOrDash(d.carbs_g_per_100g)}
                        {" · "}<span className="font-semibold text-fat">F</span> {gramsOrDash(d.fat_g_per_100g)}
                        {d.reference_serving_g ? ` · ${Number(d.reference_serving_g).toLocaleString(undefined, { maximumFractionDigits: 1 })} g serving` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-lg leading-tight font-extrabold tabular-nums">{Math.round(Number(d.calories_per_100g))}</span>
                      <span className="block text-[10px] text-muted-foreground">cal/100g</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="press flex size-12 shrink-0 items-center justify-center disabled:opacity-50"
                    aria-label={`Favorite ${d.name}`}
                    aria-pressed={d.is_favorite}
                    disabled={favorite.isPending && !favorite.isPaused}
                    onClick={() => favorite.mutate({ id: d.id, edits: { is_favorite: !d.is_favorite } })}
                  >
                    <Star className={`size-5 transition-colors ${d.is_favorite ? "fill-carbs text-carbs" : "text-muted-foreground/50"}`} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Card>
      )}
      {matching.length > visible.length && (
        <Button variant="secondary" className="w-full" onClick={() => setLimit(limit + PAGE_SIZE)}>Show more</Button>
      )}

      {dishes.isSuccess && matching.length === 0 && (
        <Card className="items-center gap-3 px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted"><UtensilsCrossed className="size-5" /></span>
          <p className="text-sm text-muted-foreground">
            {dishes.data.length > 0 ? "No foods match. Try another search or turn off the favorites filter." : "No dishes yet — add the ones you actually eat on repeat."}
          </p>
          {dishes.data.length === 0 && <Button onClick={() => setAdding(true)}><Plus /> Add dish</Button>}
        </Card>
      )}

      <Sheet
        open={open}
        onOpenChange={next => { if (!next) close(); }}
        title={editing ? "Edit dish" : "New dish"}
        footer={
          <Button type="submit" form="dish-form" size="lg" className="w-full" disabled={pending || !form.name || !form.calories_per_100g}>
            {editing ? "Save changes" : "Save dish"}
          </Button>
        }
      >
        <form id="dish-form" className="space-y-5" onSubmit={e => { e.preventDefault(); submit(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="name" className={fieldLabel}>Dish name</Label>
            <Input id="name" placeholder="e.g. Jollof rice with chicken" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="rounded-3xl bg-muted/50">
            <button type="button" className="press flex w-full items-center gap-3 p-3 text-left" aria-expanded={calculating} onClick={() => setCalculating(!calculating)}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fiber/15 text-fiber"><Calculator className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Calculate from ingredients</span>
                <span className="block truncate text-xs text-muted-foreground">{recipe ? "Ingredient breakdown saved" : "Build it from foods in your library"}</span>
              </span>
              <ChevronDown className={`mr-1 size-5 text-muted-foreground transition-transform duration-300 ${calculating ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {calculating && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pt-1 pb-3">
                    <RecipeCalculator initial={recipe} foods={(dishes.data ?? []).filter(d => d.id !== editing?.id)} onUse={(result, details) => {
                      setBasis("100g"); setFormError("");
                      setRecipe(details);
                      setForm(previous => ({ ...previous, ...Object.fromEntries(Object.entries(result.per100g).map(([key, value]) => [key, result.missing.includes(key as (typeof result.missing)[number]) ? "" : String(value)])), reference_serving_g: String(result.servingGrams) }));
                      setCalculating(false);
                    }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {recipe && <p className="text-xs text-muted-foreground">Editing nutrition directly removes the ingredient breakdown.</p>}

          <div className="space-y-2">
            <p className={fieldLabel}>Nutrition on your label</p>
            <Segmented label="Nutrition on your label" options={BASIS_OPTIONS} value={basis} onChange={changeBasis} />
          </div>
          {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}

          <label htmlFor="calories_per_100g" className="block rounded-3xl bg-muted/60 px-4 py-5 text-center transition-shadow focus-within:ring-4 focus-within:ring-foreground/[0.06]">
            <input
              id="calories_per_100g"
              className="w-full bg-transparent text-center text-5xl font-extrabold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40"
              type="number" inputMode="decimal" min="0" step="any"
              placeholder="0"
              value={form.calories_per_100g}
              onChange={e => setField("calories_per_100g", e.target.value)}
            />
            <span className="mt-1 block text-xs font-medium text-muted-foreground">Calories {per}</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            {MACRO_FIELDS.map(([key, label, dot]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key} className={fieldLabel}><span className={`size-2 rounded-full ${dot}`} />{label} (g {per})</Label>
                <Input id={key} type="number" inputMode="decimal" min="0" step="any" placeholder="Unknown" value={form[key]} onChange={e => setField(key, e.target.value)} />
              </div>
            ))}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="serving" className={fieldLabel}>Serving weight (g{basis === "100g" ? ", optional" : ", required"})</Label>
              <Input id="serving" required={basis === "serving"} type="number" inputMode="decimal" min="0.01" step="any" value={form.reference_serving_g} onChange={e => setField("reference_serving_g", e.target.value)} />
            </div>
          </div>

          {editing?.notes && (
            <details className="rounded-2xl bg-muted/50 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-semibold">Source and reference notes</summary>
              <p className="mt-2 text-xs break-words whitespace-pre-wrap text-muted-foreground">{editing.notes}</p>
              <p className="mt-2 text-xs text-muted-foreground">Notes describe the original reference; edits here are your own.</p>
            </details>
          )}

          {(add.isError || update.isError || del.isError) && (
            <p role="alert" className="text-sm text-destructive">{errorMessage(add.error ?? update.error ?? del.error)}</p>
          )}

          {editing && (
            <div className="flex justify-center">
              <Button type="button" variant={confirmingDelete ? "destructive" : "ghost"} className="text-destructive" disabled={del.isPending && !del.isPaused} onClick={() => remove(editing)}>
                <Trash2 /> {confirmingDelete ? "Tap again to delete for good" : "Delete dish"}
              </Button>
            </div>
          )}
        </form>
      </Sheet>
    </div>
  );
}
