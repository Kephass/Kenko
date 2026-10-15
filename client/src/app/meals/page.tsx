"use client";
import { matchesLibrarySearch } from "@/lib/librarySearch";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, onlineManager } from "@tanstack/react-query";
import { useSavedMeals, useWriteSavedMeal } from "@/hooks/useSavedMeals";
import { useSession } from "@/components/Providers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseSavedFoods, savedMealPreview, logSavedMeal, type SavedMeal } from "@/lib/savedMeals";
import { COPY_MEAL_KEY, type MealCopy } from "@/lib/copyMeal";
import { diaryDate, initialLogTime, localDateTime, MEAL_TYPES, type MealType } from "@/lib/tracking";
import { localDateISO, errorMessage } from "@/lib/utils";

export default function SavedMealsPage() { return <Suspense fallback={<p role="status">Loading saved meals…</p>}><MealLibrary /></Suspense>; }
function MealLibrary() {
  const params = useSearchParams();
  const day = diaryDate(params.get("date"), localDateISO());
  const meals = useSavedMeals();
  const deletion = useWriteSavedMeal();
  const [deleted, setDeleted] = useState<SavedMeal | null>(null);
  const [search, setSearch] = useState("");
  const matching = (meals.data ?? []).filter(meal => {
    let ingredients = "";
    try { ingredients = parseSavedFoods(meal.foods).map(food => food.name).join(" "); } catch { /* Keep malformed templates accessible by name for correction/deletion. */ }
    return matchesLibrarySearch(search, `${meal.name} ${ingredients}`);
  });
  return <div className="space-y-5">
    <header className="space-y-2"><h1 className="text-2xl font-extrabold">Saved meals</h1><p className="text-sm text-muted-foreground">Your usual combinations, ready to log again. Save a meal from any day in your diary.</p><Link className="text-sm underline" href={`/?date=${day}`}>Open diary</Link></header>
    <Label htmlFor="saved-meal-search">Find a saved meal or ingredient</Label><Input id="saved-meal-search" type="search" value={search} onChange={e => setSearch(e.target.value)} />
    {meals.isLoading && <p role="status">Loading saved meals…</p>}
    {meals.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(meals.error)}</p>}
    {!meals.isLoading && !meals.isError && !matching.length && <p className="text-sm text-muted-foreground">{meals.data?.length ? "No meals match that search." : "No saved meals yet. In the diary, choose ‘Save as a meal’ under a breakfast, lunch, dinner or snack."}</p>}
    {deletion.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(deletion.error)}</p>}
    {deleted && <Card className="gap-3 p-4">
      <p role="status" className="text-sm">{deletion.isError ? `Could not delete “${deleted.name}”.` : deletion.isPaused ? `“${deleted.name}” is waiting to be deleted when you reconnect.` : deletion.isPending ? `Deleting “${deleted.name}”…` : `“${deleted.name}” deleted.`}</p>
      {!deletion.isError && <Button variant="secondary" disabled={deletion.isPending && !deletion.isPaused} onClick={() => { deletion.mutate({ operation: "add", row: deleted }); setDeleted(null); }}>Undo deletion</Button>}
    </Card>}
    {matching.map(meal => <MealTemplate key={`${meal.id}-${day}`} meal={meal} day={day} deleting={deletion.isPending && !deletion.isPaused} onDelete={row => { setDeleted(row); deletion.mutate({ operation: "delete", row }); }} />)}
  </div>;
}
function MealTemplate({ meal, day, onDelete, deleting }: { meal: SavedMeal; day: string; onDelete: (meal: SavedMeal) => void; deleting: boolean }) {
  const session = useSession();
  const router = useRouter();
  const write = useWriteSavedMeal();
  const copy = useMutation<void, Error, MealCopy>({ mutationKey: COPY_MEAL_KEY });
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(meal.name);
  const [amount, setAmount] = useState("1");
  const [when, setWhen] = useState(() => initialLogTime(day));
  const [type, setType] = useState(meal.meal_type as MealType);
  const [error, setError] = useState("");
  let foods: ReturnType<typeof parseSavedFoods> = [];
  let invalid = "";
  try { foods = parseSavedFoods(meal.foods); } catch (e) { invalid = errorMessage(e); }
  let preview: ReturnType<typeof savedMealPreview> | null = null;
  try { preview = savedMealPreview(meal.foods, amount); } catch { /* Invalid input stays editable; logging is disabled. */ }
  return <Card className="gap-3 p-4">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">{meal.name}</h2><p className="text-xs text-muted-foreground">{foods.length} foods · {Math.round(foods.reduce((sum, food) => sum + food.calories, 0))} cal per saved portion</p></div><Button variant="secondary" onClick={() => { setExpanded(!expanded); setName(meal.name); }}>Choose</Button></div>
    {invalid && <p role="alert" className="text-sm text-destructive">{invalid}</p>}
    {expanded && <div className="space-y-4">
      <form className="space-y-3" onSubmit={e => {
        e.preventDefault();
        try {
          if (!session) throw new Error("Sign in to log a saved meal.");
          const input = logSavedMeal(meal, session.user.id, amount, when, type);
          setError("");
          const done = () => router.push(`/?date=${when.slice(0,10)}`);
          copy.mutate(input, { onSuccess: done });
          if (!onlineManager.isOnline()) done();
        } catch (e) { setError(errorMessage(e)); }
      }}>
        <Label htmlFor={`portions-${meal.id}`}>Saved portions</Label><Input id={`portions-${meal.id}`} required type="number" min="0.01" step="any" value={amount} onChange={e => setAmount(e.target.value)} />
        <p className="text-xs text-muted-foreground">1 is the original saved amount; 0.5 logs half of every food. {preview ? `${Math.round(preview.calories)} cal in total.` : "Enter a valid positive portion amount."}</p>
        {preview && <div className="space-y-3 rounded-xl bg-muted p-3" aria-live="polite">
          <p className="text-sm font-semibold">Ready to log · {Math.round(preview.calories)} cal</p>
          <ul className="space-y-1 text-xs">{preview.foods.map((food, i) => <li key={i}>{food.name} · {Math.round(food.calories)} cal</li>)}</ul>
          <dl className="grid grid-cols-2 gap-2 text-xs">{preview.nutrients.map(({ key, total, missing }) => <div key={key}><dt className="capitalize">{key.replace("_g", "")}</dt><dd className="font-semibold">{missing === preview.foods.length ? "Unknown" : `${Number(total.toFixed(1))} g${missing ? " known" : ""}`}{missing > 0 && <span className="block font-normal text-muted-foreground">{missing} {missing === 1 ? "food missing" : "foods missing"}</span>}</dd></div>)}</dl>
        </div>}
        <Label htmlFor={`time-${meal.id}`}>Date and time</Label><Input id={`time-${meal.id}`} required type="datetime-local" max={localDateTime()} value={when} onChange={e => setWhen(e.target.value)} />
        <Label htmlFor={`type-${meal.id}`}>Meal category</Label><select id={`type-${meal.id}`} className="h-10 w-full rounded-xl border px-3 capitalize" value={type} onChange={e => setType(e.target.value as MealType)}>{MEAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select>
        <Button disabled={!preview || !!invalid || (copy.isPending && !copy.isPaused)}>Log saved meal</Button>
      </form>
      <form className="space-y-2 border-t pt-3" onSubmit={e => { e.preventDefault(); write.mutate({ operation: "update", row: { ...meal, name } }); }}>
        <Label htmlFor={`name-${meal.id}`}>Rename meal</Label><Input id={`name-${meal.id}`} required maxLength={120} value={name} onChange={e => setName(e.target.value)} />
        <div className="flex gap-2"><Button variant="secondary" disabled={write.isPending && !write.isPaused}>Save name</Button><Button type="button" variant="destructive" disabled={deleting || (write.isPending && !write.isPaused)} onClick={() => onDelete(meal)}>Delete saved meal</Button></div>
        <p className="text-xs text-muted-foreground">Deleting this saved meal leaves logged foods in your diary.</p>
      </form>
    </div>}
    {(error || copy.isError || write.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(copy.error ?? write.error)}</p>}
  </Card>;
}
