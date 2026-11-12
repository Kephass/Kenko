"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { onlineManager, useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useWriteSavedMeal } from "@/hooks/useSavedMeals";
import { useSession } from "@/components/Providers";
import Sheet from "@/components/Sheet";
import { toast } from "@/components/Toaster";
import { Segmented } from "@/components/Chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { catalogMeal, basketTotals, basketNutrition, BASKET_NUTRIENTS, saveCatalogTemplate, type BasketPortion } from "@/lib/catalog";
import { remainingBasketAfterLog } from "@/lib/catalogDraft";
import { COPY_MEAL_KEY, type MealCopy } from "@/lib/copyMeal";
import { MEAL_OPTIONS } from "@/lib/mealMeta";
import { localDateTime, type MealType } from "@/lib/tracking";
import { errorMessage } from "@/lib/utils";

const itemName = (item: BasketPortion) => ("quick" in item ? item.quick.name : `${item.food.name}${item.food.estimated ? " (estimate)" : ""}`);
function itemCalories(item: BasketPortion) {
  try { return Math.round(Number(basketNutrition(item).calories)); } catch { return null; }
}

/** Review a multi-food meal: adjust amounts, then log it or keep it as a template. */
export default function CatalogBasket({ open, onOpenChange, items, onChange, when, setWhen, mealType, setMealType }: {
  open: boolean; onOpenChange: (open: boolean) => void;
  items: BasketPortion[]; onChange: (items: BasketPortion[] | ((current: BasketPortion[]) => BasketPortion[])) => void;
  when: string; setWhen: (when: string) => void; mealType: MealType; setMealType: (type: MealType) => void;
}) {
  const session = useSession();
  const router = useRouter();
  const write = useMutation<void, Error, MealCopy>({ mutationKey: COPY_MEAL_KEY });
  const save = useWriteSavedMeal();
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState("");
  let totals: ReturnType<typeof basketTotals> | null = null;
  try { totals = basketTotals(items); } catch { /* Invalid amounts are fixed inline before logging. */ }
  const count = `${items.length} ${items.length === 1 ? "food" : "foods"}`;

  function log() {
    try {
      const input = catalogMeal(items, session?.user.id ?? "", when, mealType);
      setError("");
      const done = () => {
        onChange((current) => remainingBasketAfterLog(current, items));
        onOpenChange(false);
        toast(`${count} logged · ${Math.round(totals?.calories ?? 0)} cal`);
        router.push(`/?date=${when.slice(0, 10)}`);
      };
      write.mutate(input, { onSuccess: done });
      if (!onlineManager.isOnline()) done();
    } catch (e) { setError(errorMessage(e)); }
  }
  function saveTemplate() {
    try {
      const row = saveCatalogTemplate(items, session?.user.id ?? "", templateName, mealType);
      setError("");
      save.mutate({ operation: "add", row });
      setTemplateName("");
      toast(`Saved “${row.name}”`);
    } catch (e) { setError(errorMessage(e)); }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Your meal"
      description={`${count}${totals ? ` · ${Math.round(totals.calories)} cal` : " · check amounts"}`}
      footer={<Button size="lg" className="w-full" disabled={!totals || !items.length || write.isPending} onClick={log}>{write.isPending ? "Logging…" : `Log ${count}`}</Button>}
    >
      {totals && (
        <div className="grid grid-cols-4 gap-2" aria-label="Meal nutrient totals" aria-live="polite">
          {BASKET_NUTRIENTS.map((key) => {
            const nutrient = totals.nutrients[key];
            return (
              <div key={key} className="rounded-2xl bg-muted/60 px-2 py-2.5 text-center">
                <p className="text-base font-extrabold tabular-nums">{nutrient.missing === items.length ? "–" : `${Math.round(nutrient.total)}g`}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{key}{nutrient.missing > 0 && nutrient.missing < items.length ? " *" : ""}</p>
              </div>
            );
          })}
        </div>
      )}
      <div className="overflow-hidden rounded-3xl bg-muted/50">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div key={item.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-black/[0.05] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{itemName(item)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{itemCalories(item) ?? "—"} cal</p>
                </div>
                <label className="flex items-baseline gap-1 rounded-xl bg-card px-2.5 py-1.5">
                  <input
                    aria-label={`${"quick" in item ? "Portions" : "Grams"} of ${itemName(item)}`}
                    className="w-14 bg-transparent text-right text-sm font-bold tabular-nums outline-none"
                    type="number" inputMode="decimal" min="0.01" step="any"
                    value={"quick" in item ? item.portions : item.grams}
                    onChange={(event) => onChange(items.map((row) => row.id === item.id ? ("quick" in row ? { ...row, portions: event.target.value } : { ...row, grams: event.target.value }) : row))}
                  />
                  <span className="text-xs text-muted-foreground">{"quick" in item ? "×" : "g"}</span>
                </label>
                <button type="button" aria-label={`Remove ${itemName(item)}`} className="press flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-card" onClick={() => onChange(items.filter((row) => row.id !== item.id))}>
                  <X className="size-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Segmented label="Meal" options={MEAL_OPTIONS} value={mealType as (typeof MEAL_OPTIONS)[number]["value"]} onChange={setMealType} />
      <Input aria-label="Meal date and time" required type="datetime-local" max={localDateTime()} value={when} onChange={(event) => setWhen(event.target.value)} />
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); saveTemplate(); }}>
        <Input aria-label="Name to save this meal as" required maxLength={120} placeholder="Save as… e.g. Usual breakfast" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
        <Button variant="secondary" className="h-12 px-5" disabled={!totals || (save.isPending && !save.isPaused)}>Save</Button>
      </form>
      <button type="button" className="w-full py-1 text-center text-sm font-semibold text-destructive" onClick={() => { onChange([]); onOpenChange(false); }}>Discard meal</button>
      {(error || write.isError || save.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(write.error ?? save.error)}</p>}
    </Sheet>
  );
}
