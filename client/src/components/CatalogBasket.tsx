"use client";

import { useState } from "react";
import Link from "next/link";
import { useWriteSavedMeal } from "@/hooks/useSavedMeals";
import { useRouter } from "next/navigation";
import { onlineManager, useMutation } from "@tanstack/react-query";
import { useSession } from "@/components/Providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { catalogMeal, basketTotals, BASKET_NUTRIENTS, saveCatalogTemplate, type BasketPortion } from "@/lib/catalog";
import { remainingBasketAfterLog } from "@/lib/catalogDraft";
import { COPY_MEAL_KEY, type MealCopy } from "@/lib/copyMeal";
import { localDateTime, MEAL_TYPES, type MealType } from "@/lib/tracking";
import { errorMessage } from "@/lib/utils";

export default function CatalogBasket({ items, onChange, when, setWhen, mealType, setMealType }: {
  items: BasketPortion[]; onChange: (items: BasketPortion[] | ((current: BasketPortion[]) => BasketPortion[])) => void;
  when: string; setWhen: (when: string) => void; mealType: MealType; setMealType: (type: MealType) => void;
}) {
  const session = useSession();
  const router = useRouter();
  const write = useMutation<void, Error, MealCopy>({ mutationKey: COPY_MEAL_KEY });
  const save = useWriteSavedMeal();
  const [templateName, setTemplateName] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [error, setError] = useState("");
  let totals: ReturnType<typeof basketTotals> | null = null;
  try { totals = basketTotals(items); }
  catch { /* Invalid weights are labelled below and validated before saving. */ }

  const total = totals?.calories ?? null;
  return <Card className="gap-3 border-primary/30 p-4">
    <h2 className="text-lg font-bold">Your meal</h2>
    <p role="status" className="text-sm">{items.length} {items.length === 1 ? "food" : "foods"}{total !== null ? ` · ${Math.round(total)} cal` : " · check weights"} · Not logged yet</p>
    {totals && <div className="grid grid-cols-2 gap-2" aria-label="Meal nutrient totals" aria-live="polite">
      {BASKET_NUTRIENTS.map(key => {
        const nutrient = totals.nutrients[key];
        return <div key={key} className="rounded-xl bg-muted p-3 text-sm"><p className="capitalize text-muted-foreground">{key}</p><p className="font-semibold">{nutrient.missing === items.length ? "Unknown" : `${Number(nutrient.total.toFixed(1))} g${nutrient.missing ? " · partial" : ""}`}</p>{nutrient.missing > 0 && <p className="text-xs text-muted-foreground">Missing for {nutrient.missing} {nutrient.missing === 1 ? "food" : "foods"}</p>}</div>;
      })}
    </div>}
    <p className="text-xs text-muted-foreground">Keep adding foods below. Review each weight or portion multiplier before logging. Your unfinished meal is saved in this browser for this account and diary day.</p>
    {items.length === 100 && <p role="status" className="text-sm">This meal has reached its 100-food limit.</p>}
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault();
      try {
        const input = catalogMeal(items, session?.user.id ?? "", when, mealType);
        setError("");
        const done = () => { onChange(current => remainingBasketAfterLog(current, items)); router.push(`/?date=${when.slice(0, 10)}`); };
        write.mutate(input, { onSuccess: done });
        if (!onlineManager.isOnline()) done();
      } catch (error) { setError(errorMessage(error)); }
    }}>
      <fieldset disabled={write.isPending} className="space-y-3">
        {items.map(item => <div key={item.id} className="space-y-2 rounded-xl bg-muted p-3">
          <p className="text-sm font-semibold">{"quick" in item ? item.quick.name : item.food.name}{!("quick" in item) && item.food.estimated ? " (estimate)" : ""}</p>
          <Label htmlFor={`basket-${item.id}`}>{"quick" in item ? "Portions of entered amount" : "Edible weight (g)"}</Label>
          <div className="flex gap-2"><Input id={`basket-${item.id}`} required type="number" min="0.01" step="any" value={"quick" in item ? item.portions : item.grams} onChange={event => onChange(items.map(row => row.id === item.id ? ("quick" in row ? { ...row, portions: event.target.value } : { ...row, grams: event.target.value }) : row))} /><Button type="button" variant="ghost" aria-label={`Remove ${"quick" in item ? item.quick.name : item.food.name}`} onClick={() => onChange(items.filter(row => row.id !== item.id))}>Remove</Button></div>
        </div>)}
        <Label htmlFor="basket-when">Meal date and time</Label>
        <Input id="basket-when" required type="datetime-local" max={localDateTime()} value={when} onChange={event => setWhen(event.target.value)} />
        <Label htmlFor="basket-type">Meal category</Label>
        <select id="basket-type" className="h-10 w-full rounded-md border bg-card px-3 text-sm capitalize" value={mealType} onChange={event => setMealType(event.target.value as MealType)}>{MEAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select>
        <Button type="button" variant="ghost" onClick={() => onChange([])}>Discard draft</Button>
        <Button className="w-full" disabled={total === null}>{write.isPending ? "Logging meal…" : `Log ${items.length} ${items.length === 1 ? "food" : "foods"}`}</Button>
      </fieldset>
      {(error || write.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(write.error)}</p>}
    </form>
    <details className="rounded-xl border p-3">
      <summary className="cursor-pointer text-sm font-semibold">Save as a reusable meal</summary>
      <form className="mt-3 space-y-3" onSubmit={event => {
        event.preventDefault();
        try {
          const row = saveCatalogTemplate(items, session?.user.id ?? "", templateName, mealType);
          setSaveError(""); setSaveMessage("");
          save.mutate({ operation: "add", row }, { onSuccess: () => setSaveMessage(`Saved “${row.name}”.`) });
          if (!onlineManager.isOnline()) setSaveMessage(`“${row.name}” is saved on this device and waiting to sync.`);
        } catch (error) { setSaveError(errorMessage(error)); }
      }}>
        <p className="text-xs text-muted-foreground">Keep these food portions together for next time. Saving a template does not add anything to your diary or clear your draft.</p>
        <Label htmlFor="basket-template-name">Meal name</Label>
        <Input id="basket-template-name" required maxLength={120} placeholder="e.g. My usual breakfast" value={templateName} onChange={event => { setTemplateName(event.target.value); setSaveMessage(""); }} />
        <Button variant="secondary" disabled={total === null || save.isPending || write.isPending}>{save.isPending ? "Saving…" : "Save meal template"}</Button>
        {(saveError || save.isError) && <p role="alert" className="text-sm text-destructive">{saveError || errorMessage(save.error)}</p>}
        {saveMessage && !save.isError && <p role="status" className="text-sm">{saveMessage} <Link className="underline" href={`/meals?date=${when.slice(0,10)}`}>Open saved meals</Link></p>}
      </form>
    </details>
  </Card>;
}
