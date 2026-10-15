"use client";
import { useIsMutating } from "@tanstack/react-query";
import { COPY_MEAL_KEY } from "@/lib/copyMeal";
import { useMemo, useState } from "react";
import foodsData from "@/data/food-catalog.json";
import { catalogDish, catalogNutrition, searchCatalog, PREPARATIONS, type Preparation, type CatalogFood } from "@/lib/catalog";
import { useAddDish, useDishes } from "@/hooks/useDishes";
import { finiteNumber } from "@/lib/tracking";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
const foods: CatalogFood[] = foodsData;
const categories = ["Fruits", "Vegetables", "Beans & legumes", "Drinks", "Cocktails", "Mocktails", "Meals", "Grains", "Dairy & eggs", "Nuts & seeds"];
export default function FoodCatalog({ onUse, onAdd, basketCount }: { basketCount: number; onUse: (name: string, values: ReturnType<typeof catalogNutrition>) => void; onAdd: (food: CatalogFood, grams: number) => void }) {
  const batchPending = useIsMutating({ mutationKey: COPY_MEAL_KEY }) > 0;
  const addDish = useAddDish();
  const dishes = useDishes();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [preparation, setPreparation] = useState<Preparation | "">("");
  const [selected, setSelected] = useState<CatalogFood | null>(null);
  const [portion, setPortion] = useState("grams");
  const [amount, setAmount] = useState("100");
  const [limit, setLimit] = useState(30);
  const existing = selected && dishes.data?.some(dish => dish.notes?.split("\n")[0] === `Kenko catalog: ${selected.id}`);
  const matching = useMemo(() => searchCatalog(foods, query, category, preparation), [query, category, preparation]);
  let grams = 0, values: ReturnType<typeof catalogNutrition> | null = null, error = "";
  if (selected) {
    try { grams = finiteNumber(amount, "Amount", true) * (portion === "grams" ? 1 : selected.portions[Number(portion)].grams); values = catalogNutrition(selected, grams); }
    catch (e) { error = errorMessage(e); }
  }
  return <section className="space-y-4">
    <div><h2 className="text-xl font-bold">Food & drink catalog</h2><p className="mt-1 text-sm text-muted-foreground">{foods.length.toLocaleString()} reference foods and drinks, ready to measure. Match the preparation: raw, cooked, canned or dried.</p></div>
    <Label htmlFor="catalog-search">Find a food or drink</Label>
    <Input id="catalog-search" type="search" placeholder="Banana, black beans, coffee, pina colada…" value={query} onChange={e => { setQuery(e.target.value); setLimit(30); }} />
    <Label htmlFor="catalog-category">Category</Label>
    <select id="catalog-category" className="h-10 w-full rounded-md border bg-card px-3 text-sm" value={category} onChange={e => { setCategory(e.target.value); setLimit(30); }}><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
    <Label htmlFor="catalog-preparation">Preparation</Label>
    <select id="catalog-preparation" className="h-10 w-full rounded-md border bg-card px-3 text-sm" value={preparation} onChange={event => { setPreparation(event.target.value as Preparation | ""); setLimit(30); }}><option value="">All preparations</option>{PREPARATIONS.map(value => <option key={value}>{value}</option>)}</select>
    <p className="text-xs text-muted-foreground">Preparation filters match the source description. A food can be both frozen and cooked. Common names such as courgette, aubergine and garbanzo also work.</p>
    {selected && <Card className="gap-3 border-primary/30 p-4">
      <div className="flex items-start justify-between gap-2"><h3 className="font-bold">{selected.name}</h3><Button variant="ghost" size="sm" onClick={() => setSelected(null)} aria-label="Close selected food">Close</Button></div>
      <p className="text-xs text-muted-foreground">{selected.estimated ? "Recipe estimate — portions and ingredients vary." : "Reference nutrition — your food may vary."} Edible weight only. Grams are weight, not millilitres.</p>
      {selected.recipe ? <details><summary className="cursor-pointer text-sm underline">Recipe and ingredient sources</summary><p className="mt-2 text-xs text-muted-foreground">{selected.recipe}</p></details> : <a href={`https://fdc.nal.usda.gov/food-details/${selected.id}/nutrients`} target="_blank" rel="noreferrer" className="text-xs underline">USDA source · SR Legacy (2018)</a>}
      <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor="catalog-amount">Amount</Label><Input id="catalog-amount" type="number" min="0.01" step="any" value={amount} onChange={e => setAmount(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="catalog-portion">Measure</Label><select id="catalog-portion" className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={portion} onChange={e => { const next = e.target.value; setPortion(next); setAmount(String(grams > 0 ? grams / (next === "grams" ? 1 : selected.portions[Number(next)].grams) : next === "grams" ? 100 : 1)); }}><option value="grams">Grams</option>{selected.portions.map((p,i) => <option key={i} value={i}>{p.label} ({p.grams} g)</option>)}</select></div></div>
      {values && <div className="rounded-xl bg-muted p-3 text-sm" aria-live="polite"><p className="font-bold">{Number(grams.toFixed(2))} g · {Math.round(Number(values.calories))} cal</p><p>Protein {values.protein || "unknown"} g · Carbs {values.carbs || "unknown"} g · Fat {values.fat || "unknown"} g · Fiber {values.fiber || "unknown"} g</p></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button disabled={!values || batchPending || basketCount >= 100} onClick={() => { if (values) onAdd(selected, grams); }}>Add to meal{basketCount > 0 ? ` (${basketCount} added)` : ""}</Button>
      <Button variant="secondary" disabled={!values} onClick={() => { if(values) onUse(`${selected.name} · ${Number(grams.toFixed(2))} g${selected.estimated ? " (estimate)" : ""}`, values); }}>Review and log</Button>
      <Button variant="secondary" disabled={!values || addDish.isPending || !!existing} onClick={() => { if (selected && values) addDish.mutate(catalogDish(selected, grams)); }}>{existing ? "Saved to My dishes" : addDish.isPending ? "Saving…" : "Save to My dishes"}</Button>
      <p className="text-xs text-muted-foreground">Save this food for recipes and repeat logging. Your measured amount becomes one serving; nutrition stays per 100 g.</p>
      {addDish.isPaused && <p role="status" className="text-sm">Saved on this device; waiting to sync.</p>}
      {addDish.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(addDish.error)}</p>}
      <p className="text-xs text-muted-foreground">Review the date, meal category and nutrition before saving. Drinks log as food energy; they do not automatically add to your water total.</p>
    </Card>}
    <p role="status" className="text-xs text-muted-foreground">{matching.length.toLocaleString()} matches{matching.length > limit ? ` · showing ${limit}` : ""}</p>
    <div className="space-y-2">{matching.slice(0,limit).map(food => <button key={food.id} className={`w-full rounded-xl border p-3 text-left ${selected?.id === food.id ? "border-primary bg-muted" : "bg-card"}`} onClick={() => { setSelected(food); setPortion(food.portions.length ? "0" : "grams"); setAmount(food.portions.length ? "1" : "100"); }} aria-pressed={selected?.id === food.id}><span className="block text-sm font-semibold">{food.name}</span><span className="text-xs text-muted-foreground">{food.category} · {food.nutrition.calories} cal / 100 g{food.estimated ? " · estimate" : ""}</span></button>)}</div>
    {!matching.length && <p className="rounded-xl bg-muted p-4 text-sm">No match yet. Try a simpler name or another category, or use Quick add for your label or recipe.</p>}
    {matching.length > limit && <Button variant="secondary" className="w-full" onClick={() => setLimit(limit+30)}>Show more</Button>}
    <p className="text-xs text-muted-foreground">USDA SR Legacy reference data plus Kenko mocktail recipes. Broad coverage, not every food worldwide. Available offline after the catalog has loaded.</p>
  </section>;
}
