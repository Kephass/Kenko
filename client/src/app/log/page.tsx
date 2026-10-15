"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onlineManager, useIsMutating } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddManualMealLog, useRecentMeals } from "@/hooks/useMealLogs";
import { useDishes, useUpdateDish } from "@/hooks/useDishes";
import { useSession } from "@/components/Providers";
import BackButton from "@/components/BackButton";
import MacroInputs from "@/components/MacroInputs";
import { errorMessage, localDateISO } from "@/lib/utils";
import { diaryDate, measuredFoodName, repeatedFoodName, localDateTime, logTimestamp, repeatNutrition, nutritionInput, portionGrams, portionFromGrams, type PortionUnit, MEAL_TYPES, type MealType } from "@/lib/tracking";
import { COPY_MEAL_KEY } from "@/lib/copyMeal";
import { savedDishCatalogFood, quickBasketPortion } from "@/lib/catalog";
import CatalogBasket from "@/components/CatalogBasket";
import { useCatalogDraft } from "@/hooks/useCatalogDraft";
import type { Tables } from "@/lib/types";

const FoodCatalog = dynamic(() => import("@/components/FoodCatalog"), { loading: () => <p role="status">Loading food catalog…</p> });

export default function LogPage() {
  return <Suspense fallback={<p role="status">Loading food logger…</p>}><DatedFoodLogger /></Suspense>;
}
function DatedFoodLogger() {
  const params = useSearchParams();
  const day = diaryDate(params.get("date"), localDateISO());
  return <FoodLogger key={day} initialDay={day} />;
}
function FoodLogger({ initialDay }: { initialDay: string }) {
  const router = useRouter();
  const session = useSession();
  const dishes = useDishes();
  const recent = useRecentMeals();
  const add = useAddManualMealLog();
  const basketPending = useIsMutating({ mutationKey: COPY_MEAL_KEY }) > 0;
  const favorite = useUpdateDish();
  const draft = useCatalogDraft(session?.user.id ?? "", initialDay);
  const { items: basket, setItems: setBasket, when, setWhen, mealType, setMealType } = draft;
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [mode, setMode] = useState<"dishes" | "quick" | "recent" | "catalog">("dishes");
  const [search, setSearch] = useState("");
  const [dishId, setDishId] = useState("");
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState<PortionUnit>("servings");
  const [repeat, setRepeat] = useState<Tables<"meal_logs"> | null>(null);
  const [repeatAmount, setRepeatAmount] = useState("1");
  const [recentSearch, setRecentSearch] = useState("");
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({ calories: "", protein: "", carbs: "", fat: "", fiber: "" });
  const [error, setError] = useState("");
  const dish = mode === "dishes" ? dishes.data?.find((d) => d.id === dishId) : undefined;
  let grams = 0;
  try { if (dish) grams = portionGrams(amount, unit, dish.reference_serving_g); } catch { /* Form reports invalid portions on submit. */ }
  const scale = grams / 100;
  const matching = (dishes.data ?? []).filter((d) => (!favoritesOnly || d.is_favorite) && `${d.name} ${d.name_local ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  const matchingRecent = (recent.data ?? []).filter(meal => (meal.raw_text_input || dishes.data?.find(d => d.id === meal.dish_id)?.name || "Meal").toLowerCase().includes(recentSearch.toLowerCase()));

  function reuse(meal: Tables<"meal_logs">) {
    setName(meal.raw_text_input || dishes.data?.find((d) => d.id === meal.dish_id)?.name || "Meal");
    setValues(repeatNutrition(meal, "1"));
    setRepeat(meal); setRepeatAmount("1");
    setMode("quick"); setError("");
  }

  function changeRepeat(amount: string) {
    setRepeatAmount(amount);
    if (!repeat) return;
    try { setValues(repeatNutrition(repeat, amount)); setError(""); }
    catch (e) { setError(errorMessage(e)); }
  }

  function changeValue(key: string, value: string) {
    setRepeat(null);
    setValues(previous => ({ ...previous, [key]: value }));
  }

  function submit() {
    try {
      if (!session) throw new Error("Sign in to log a meal.");
      if (mode === "dishes" && !dish) throw new Error("Choose a dish or use Quick add.");
      if (repeat && mode === "quick") repeatNutrition(repeat, repeatAmount);
      const logged_at = logTimestamp(when);
      let nutrition;
      if (dish) {
        const portion = portionGrams(amount, unit, dish.reference_serving_g);
        nutrition = {
          dish_id: dish.id,
          portion_ratio: portion / (dish.reference_serving_g ?? 100),
          calories: Number(dish.calories_per_100g) * portion / 100,
          protein_g: dish.protein_g_per_100g == null ? null : Number(dish.protein_g_per_100g) * portion / 100,
          carbs_g: dish.carbs_g_per_100g == null ? null : Number(dish.carbs_g_per_100g) * portion / 100,
          fat_g: dish.fat_g_per_100g == null ? null : Number(dish.fat_g_per_100g) * portion / 100,
          fiber_g: dish.fiber_g_per_100g == null ? null : Number(dish.fiber_g_per_100g) * portion / 100,
          raw_text_input: measuredFoodName(dish.name, portion),
        };
      } else {
        if (!name.trim()) throw new Error("Give this food or meal a name.");
        nutrition = { ...nutritionInput(values), raw_text_input: repeat ? repeatedFoodName(name, repeatAmount) : name.trim() };
      }
      setError("");
      add.mutate({ id: crypto.randomUUID(), user_id: session.user.id, logged_at, meal_type: mealType, ...nutrition }, { onSuccess: () => router.push(`/?date=${when.slice(0, 10)}`) });
      if (!onlineManager.isOnline()) router.push(`/?date=${when.slice(0, 10)}`);
    } catch (e) { setError(errorMessage(e)); }
  }

  return (
    <div className="space-y-5">
      <div className="relative flex items-center justify-center pt-1">
        <div className="absolute left-0"><BackButton /></div>
        <h1 className="text-xl font-extrabold tracking-tight">Log food</h1>
      </div>
      <div className="grid grid-cols-2 gap-2" aria-label="Logging method">
        {([ ["catalog", "Catalog"], ["dishes", "My dishes"], ["quick", "Quick add"], ["recent", "Recent"] ] as const).map(([key, label]) => (
          <Button key={key} variant={mode === key ? "default" : "secondary"} className="flex-1 rounded-full" aria-pressed={mode === key} onClick={() => { setMode(key); setError(""); }}>{label}</Button>
        ))}
      </div>
      <Link href={`/meals?date=${when.slice(0, 10)}`} className="block text-center text-sm font-semibold underline">Choose a saved meal</Link>
      {draft.error && <p role="alert" className="text-sm text-destructive">{draft.error}</p>}
      {!!basket.length && <CatalogBasket items={basket} onChange={setBasket} when={when} setWhen={setWhen} mealType={mealType} setMealType={setMealType} />}
      {mode === "catalog" ? <FoodCatalog basketCount={basket.length} onAdd={(food, grams) => setBasket(items => items.length < 100 ? [...items, { id: crypto.randomUUID(), food, grams: String(grams) }] : items)} onUse={(foodName, nutrition) => { setName(foodName); setValues(nutrition); setRepeat(null); setMode("quick"); setError(""); }} /> : mode === "recent" ? (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">Reuse a recent entry, then adjust it before logging.</p>
          <Label htmlFor="recent-search">Search recent food</Label>
          <Input id="recent-search" type="search" value={recentSearch} placeholder="Food or meal name" onChange={e => setRecentSearch(e.target.value)} />
          {recent.isLoading && <p role="status">Loading recent food…</p>}
          {recent.isError && <p role="alert">{errorMessage(recent.error)}</p>}
          {!recent.isLoading && !recent.isError && !recent.data?.length && <p className="text-sm">Your logged food will appear here.</p>}
          {!!recent.data?.length && !matchingRecent.length && <p className="text-sm text-muted-foreground">No recent food matches that search.</p>}
          {matchingRecent.map((meal) => (
            <button key={meal.id} className="w-full rounded-2xl bg-card p-4 text-left shadow-soft" onClick={() => reuse(meal)}>
              <span className="block font-semibold">{meal.raw_text_input || dishes.data?.find((d) => d.id === meal.dish_id)?.name || "Meal"}</span>
              <span className="text-sm text-muted-foreground">{Math.round(Number(meal.calories))} cal · {new Date(meal.logged_at).toLocaleDateString()}</span>
            </button>
          ))}
        </section>
      ) : (
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="meal-time">When did you eat?</Label>
            <Input id="meal-time" required type="datetime-local" max={localDateTime()} value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meal-type">Meal</Label>
            <select id="meal-type" className="h-10 w-full rounded-md border px-3 text-sm capitalize" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>{MEAL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          </div>
          {mode === "dishes" ? (
            <Card className="gap-4 p-4">
              <Label htmlFor="dish-search">Search your dishes</Label>
              <Input id="dish-search" type="search" placeholder="e.g. Jollof rice" value={search} onChange={(e) => setSearch(e.target.value)} />
              {dishes.isLoading && <p role="status">Loading dishes…</p>}
              {dishes.isError && <p role="alert">{errorMessage(dishes.error)}</p>}
              <Button type="button" variant="secondary" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>{favoritesOnly ? "★ Favorites only" : "Show favorites"}</Button>
              <div className="max-h-48 space-y-2 overflow-y-auto" aria-label="Saved dishes">
                {matching.map((d) => <Button type="button" key={d.id} variant={d.id === dishId ? "default" : "secondary"} aria-pressed={d.id === dishId} className="w-full justify-start" onClick={() => { setDishId(d.id); setUnit("servings"); setAmount("1"); }}>{d.name}</Button>)}
              </div>
              {!dishes.isLoading && !dishes.isError && !matching.length && <p className="text-sm text-muted-foreground">No matching dishes. <Link className="underline" href="/dishes">Add a dish</Link> or use Quick add.</p>}
              {dish && <>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{dish.name}</p>
                  <Button type="button" variant="ghost" size="sm" aria-pressed={dish.is_favorite} disabled={favorite.isPending && !favorite.isPaused} onClick={() => favorite.mutate({ id: dish.id, edits: { is_favorite: !dish.is_favorite } })}>{dish.is_favorite ? "★ Favorited" : "☆ Favorite"}</Button>
                </div>
                {favorite.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(favorite.error)}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label htmlFor="portion">Amount</Label><Input id="portion" required type="number" min="0.01" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="portion-unit">Unit</Label><select id="portion-unit" className="h-9 w-full rounded-md border px-3 text-sm" value={unit} onChange={(e) => { const next = e.target.value as PortionUnit; setUnit(next); setAmount(String(portionFromGrams(grams || (dish.reference_serving_g ?? 100), next, dish.reference_serving_g))); }}><option value="servings">Servings</option><option value="grams">Grams</option><option value="ounces">Ounces (weight)</option></select></div>
                </div>
                <p className="text-xs text-muted-foreground">1 serving = {dish.reference_serving_g ?? 100} g{dish.reference_serving_g == null ? " (default; edit in My dishes)" : ""}</p>
                <div className="rounded-xl bg-muted/60 p-3 text-sm tabular-nums" aria-live="polite">
                  <p className="font-bold">{Math.round(grams * 10) / 10} g · {Math.round(Number(dish.calories_per_100g) * scale)} calories</p>
                  <p>Protein {dish.protein_g_per_100g == null ? "not entered" : `${(Number(dish.protein_g_per_100g) * scale).toFixed(1)} g`} · Carbs {dish.carbs_g_per_100g == null ? "not entered" : `${(Number(dish.carbs_g_per_100g) * scale).toFixed(1)} g`}</p>
                  <p>Fat {dish.fat_g_per_100g == null ? "not entered" : `${(Number(dish.fat_g_per_100g) * scale).toFixed(1)} g`} · Fiber {dish.fiber_g_per_100g == null ? "not entered" : `${(Number(dish.fiber_g_per_100g) * scale).toFixed(1)} g`}</p>
                </div>
                <Button type="button" variant="secondary" disabled={grams <= 0 || basketPending || basket.length >= 100} onClick={() => {
                  try {
                    const weight = portionGrams(amount, unit, dish.reference_serving_g);
                    setBasket(items => [...items, { id: crypto.randomUUID(), food: savedDishCatalogFood(dish), grams: String(weight) }]);
                    setError("");
                  } catch (error) { setError(errorMessage(error)); }
                }}>Add to meal{basket.length ? ` (${basket.length} added)` : ""}</Button>
              </>}
            </Card>
          ) : (
            <Card className="gap-3 p-4">
              <Label htmlFor="food-name">Food or meal name</Label>
              <Input id="food-name" required placeholder="e.g. Lunch at home" value={name} onChange={(e) => setName(e.target.value)} />
              {repeat && <div className="space-y-2 rounded-xl bg-muted/60 p-3">
                <Label htmlFor="repeat-amount">Portions of your previous entry</Label>
                <Input id="repeat-amount" required type="number" min="0.01" step="any" value={repeatAmount} onChange={e => changeRepeat(e.target.value)} />
                <div className="flex gap-2">{[0.5, 1, 2].map(amount => <Button key={amount} type="button" variant="secondary" aria-pressed={repeatAmount === String(amount)} onClick={() => changeRepeat(String(amount))}>{amount}×</Button>)}</div>
                <p className="text-xs text-muted-foreground">1× is the portion you logged previously. Nutrients scale together; you can also edit them individually below.</p>
              </div>}
              <Label htmlFor="meal-calories">Calories for the amount you ate</Label>
              <Input id="meal-calories" required type="number" min="0" step="any" value={values.calories} onChange={(e) => changeValue("calories", e.target.value)} />
              <MacroInputs values={values} onChange={changeValue} />
              <p className="text-xs text-muted-foreground">Enter the totals from the label or recipe for your portion.</p>
              <Button type="button" variant="secondary" disabled={basketPending || basket.length >= 100} onClick={() => {
                try {
                  if (repeat) repeatNutrition(repeat, repeatAmount);
                  const item = quickBasketPortion(repeat ? repeatedFoodName(name, repeatAmount) : name, values);
                  setBasket(items => [...items, item]); setError("");
                } catch (error) { setError(errorMessage(error)); }
              }}>Add to meal{basket.length ? ` (${basket.length} added)` : ""}</Button>
              <p className="text-xs text-muted-foreground">In the basket, 1 portion equals these entered totals. No weight is assumed.</p>
            </Card>
          )}
          <Button className="h-12 w-full rounded-full" disabled={add.isPending || (mode === "dishes" && !dish)}>{add.isPending ? "Logging…" : "Log food"}</Button>
          {(error || add.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(add.error)}</p>}
        </form>
      )}
    </div>
  );
}
