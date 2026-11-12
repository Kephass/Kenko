"use client";

import { useState } from "react";
import { BookmarkPlus, Check, ShoppingBasket, Star } from "lucide-react";
import Sheet from "@/components/Sheet";
import Stepper from "@/components/Stepper";
import AnimatedNumber from "@/components/AnimatedNumber";
import { Chip } from "@/components/Chips";
import { Button } from "@/components/ui/button";
import { useAddDish, useDishes, useUpdateDish } from "@/hooks/useDishes";
import { catalogDish, catalogNutrition, type CatalogFood } from "@/lib/catalog";
import { MACROS } from "@/lib/macros";
import { finiteNumber } from "@/lib/tracking";
import type { Tables } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

const GRAMS_PER_OUNCE = 28.349523125;
const NUTRIENTS = [...MACROS.map(({ key, label, colorClass }) => ({ key, label, colorClass })), { key: "fiber", label: "Fiber", colorClass: "text-fiber" }] as const;

/** Pick a portion of one food, see its numbers live, then log or add to a meal. */
export default function FoodSheet({ food, dish, open, onOpenChange, mealLabel, basketCount, onLog, onAdd }: {
  food: CatalogFood;
  dish?: Tables<"dishes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealLabel: string;
  basketCount: number;
  onLog: (grams: number) => void;
  onAdd: (grams: number) => void;
}) {
  const units = [...food.portions, { label: "g", grams: 1 }, { label: "oz", grams: GRAMS_PER_OUNCE }];
  const [unit, setUnit] = useState(0);
  const [amount, setAmount] = useState(food.portions.length ? "1" : "100");
  const dishes = useDishes();
  const addDish = useAddDish();
  const favorite = useUpdateDish();
  const current = dish ? dishes.data?.find((row) => row.id === dish.id) ?? dish : undefined;
  const saved = !dish && dishes.data?.some((row) => row.notes?.split("\n")[0] === `Kenko catalog: ${food.id}`);

  let grams = 0, values: ReturnType<typeof catalogNutrition> | null = null, error = "";
  try {
    grams = finiteNumber(amount, "Amount", true) * units[unit].grams;
    values = catalogNutrition(food, grams);
  } catch (e) { error = errorMessage(e); }
  const isWeight = units[unit].grams === 1;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={food.name}
      description={`${food.category} · ${food.nutrition.calories} cal per 100 g${food.estimated ? " · estimate" : ""}`}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="lg" className="px-4" disabled={!values || basketCount >= 100} aria-label="Add to a meal you are building" onClick={() => onAdd(grams)}>
            <ShoppingBasket className="size-5" />
            {basketCount > 0 && <span className="tabular-nums">{basketCount}</span>}
          </Button>
          <Button type="button" size="lg" className="flex-1" disabled={!values} onClick={() => onLog(grams)}>Log to {mealLabel}</Button>
        </div>
      }
    >
      <div className="rounded-3xl bg-muted/50 p-5 text-center" aria-live="polite">
        <p className="text-6xl leading-none font-extrabold tracking-tighter tabular-nums">
          <AnimatedNumber value={values ? Number(values.calories) : 0} />
        </p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">calories · {Number(grams.toFixed(1))} g</p>
        <div className="mt-4 grid grid-cols-4 gap-1">
          {NUTRIENTS.map(({ key, label, colorClass }) => (
            <div key={key}>
              <p className="text-base font-extrabold tabular-nums">{values && values[key] !== "" ? `${Math.round(Number(values[key]) * 10) / 10}` : "–"}<span className="text-xs font-semibold text-muted-foreground">g</span></p>
              <p className={`text-[11px] font-semibold ${colorClass}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      <Stepper label="Amount" value={amount} onChange={setAmount} step={isWeight ? 10 : 0.5} min={0} />
      <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 py-1" role="radiogroup" aria-label="Measure">
        {units.map((option, index) => (
          <Chip
            key={index}
            role="radio"
            aria-checked={unit === index}
            selected={unit === index}
            className={unit === index ? "" : "bg-muted shadow-none ring-0"}
            onClick={() => {
              setUnit(index);
              setAmount(String(grams > 0 ? Math.round((grams / option.grams) * 100) / 100 : option.grams === 1 ? 100 : 1));
            }}
          >
            {option.label}{option.grams > 1 && option.label !== "oz" && <span className="opacity-60">{option.grams} g</span>}
          </Chip>
        ))}
      </div>
      {error && amount !== "" && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {current ? (
        <button type="button" aria-pressed={current.is_favorite} className="press flex w-full items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3 text-left text-sm font-semibold" onClick={() => favorite.mutate({ id: current.id, edits: { is_favorite: !current.is_favorite } })}>
          <Star className={`size-4.5 ${current.is_favorite ? "fill-carbs text-carbs" : "text-muted-foreground"}`} />
          {current.is_favorite ? "Favorite" : "Add to favorites"}
        </button>
      ) : (
        <button type="button" disabled={!values || !!saved || addDish.isPending} className="press flex w-full items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3 text-left text-sm font-semibold disabled:opacity-60" onClick={() => { if (values) addDish.mutate(catalogDish(food, grams)); }}>
          {saved ? <Check className="size-4.5 text-fiber" /> : <BookmarkPlus className="size-4.5 text-muted-foreground" />}
          {saved ? "Saved to My dishes" : "Save to My dishes"}
        </button>
      )}
      {(addDish.isError || favorite.isError) && <p role="alert" className="text-sm text-destructive">{errorMessage(addDish.error ?? favorite.error)}</p>}
      {food.recipe && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold">Recipe and sources</summary><p className="mt-2">{food.recipe}</p></details>}
    </Sheet>
  );
}
