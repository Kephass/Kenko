"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsMutating, useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, Check, Clock, Plus, Search, Star, X, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import BackButton from "@/components/BackButton";
import CatalogBasket from "@/components/CatalogBasket";
import FoodSheet from "@/components/log/FoodSheet";
import QuickAddSheet, { type QuickEntry } from "@/components/log/QuickAddSheet";
import { Chip, Segmented } from "@/components/Chips";
import { toast } from "@/components/Toaster";
import { useSession } from "@/components/Providers";
import { useAddManualMealLog, useDeleteMealLog, useRecentMeals } from "@/hooks/useMealLogs";
import { useDishes } from "@/hooks/useDishes";
import { useSavedMeals } from "@/hooks/useSavedMeals";
import { useCatalogDraft } from "@/hooks/useCatalogDraft";
import { CATALOG_CATEGORIES, useCatalogFoods } from "@/hooks/useCatalogFoods";
import { basketTotals, catalogNutrition, quickBasketPortion, savedDishCatalogFood, searchCatalog, type BasketPortion, type CatalogFood } from "@/lib/catalog";
import { COPY_MEAL_KEY, type MealCopy } from "@/lib/copyMeal";
import { matchesLibrarySearch } from "@/lib/librarySearch";
import { MEAL_META, MEAL_OPTIONS } from "@/lib/mealMeta";
import type { ManualMealInput } from "@/lib/mealLogMutations";
import { isZeroPointFood } from "@/lib/points";
import { logSavedMeal, parseSavedFoods, type SavedMeal } from "@/lib/savedMeals";
import { diaryDate, localDateTime, logTimestamp, measuredFoodName, MEAL_TYPES, nutritionInput, repeatNutrition, type MealType } from "@/lib/tracking";
import type { Tables } from "@/lib/types";
import { errorMessage, localDateISO } from "@/lib/utils";

type Meal = Tables<"meal_logs">;
type Dish = Tables<"dishes">;
type Open =
  | { kind: "food"; key: string; food: CatalogFood; dish?: Dish }
  | { kind: "quick"; key: string; repeat?: Meal; name?: string };

const EASE = [0.16, 1, 0.3, 1] as const;

export default function LogPage() {
  return <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}><DatedFoodLogger /></Suspense>;
}
function DatedFoodLogger() {
  const params = useSearchParams();
  const day = diaryDate(params.get("date"), localDateISO());
  const meal = params.get("meal");
  return <FoodLogger key={day} initialDay={day} initialMeal={MEAL_TYPES.includes(meal as MealType) ? (meal as MealType) : null} />;
}

/** One result: tap the row for portions, tap + to log the usual amount now. */
function Row({ title, subtitle, icon, onOpen, onQuick, quickLabel }: { title: string; subtitle: string; icon?: React.ReactNode; onOpen: () => void; onQuick: () => void; quickLabel: string }) {
  const [done, setDone] = useState(false);
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="flex items-center border-b border-black/[0.05] last:border-0">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left active:opacity-60" onClick={onOpen}>
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="block truncate text-xs text-muted-foreground tabular-nums">{subtitle}</span>
        </span>
      </button>
      <button
        type="button"
        aria-label={quickLabel}
        className={`press m-2 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${done ? "bg-fiber text-white" : "bg-muted text-foreground"}`}
        onClick={() => { onQuick(); setDone(true); setTimeout(() => setDone(false), 1400); }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={done ? "done" : "add"} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.15 }}>
            {done ? <Check className="size-4.5" strokeWidth={3} /> : <Plus className="size-4.5" strokeWidth={2.4} />}
          </motion.span>
        </AnimatePresence>
      </button>
    </motion.li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <ul className="overflow-hidden rounded-3xl bg-card shadow-soft ring-1 ring-black/[0.04]">
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </ul>
    </section>
  );
}

function FoodLogger({ initialDay, initialMeal }: { initialDay: string; initialMeal: MealType | null }) {
  const router = useRouter();
  const session = useSession();
  const dishes = useDishes();
  const recent = useRecentMeals();
  const savedMeals = useSavedMeals();
  const catalog = useCatalogFoods();
  const add = useAddManualMealLog();
  const del = useDeleteMealLog();
  const copy = useMutation<void, Error, MealCopy>({ mutationKey: COPY_MEAL_KEY });
  const basketPending = useIsMutating({ mutationKey: COPY_MEAL_KEY }) > 0;
  const draft = useCatalogDraft(session?.user.id ?? "", initialDay);
  const { items: basket, setItems: setBasket, when, setWhen } = draft;
  const [mealOverride, setMealOverride] = useState(initialMeal);
  const mealType = mealOverride ?? draft.mealType;
  const setMealType = (type: MealType) => { setMealOverride(type); draft.setMealType(type); };
  const mealLabel = MEAL_META[mealType].label;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [limit, setLimit] = useState(20);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeEdited, setTimeEdited] = useState(false);
  const [sheet, setSheet] = useState<Open | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);
  const show = (next: Open) => { setSheet(next); setSheetOpen(true); };
  const searching = query.trim().length > 0;
  const dishName = (meal: Meal) => meal.raw_text_input || dishes.data?.find((d) => d.id === meal.dish_id)?.name || "Meal";

  // Latest entry per distinct name, so "Recent" reads as a list of usual foods.
  const recents = useMemo(() => {
    const seen = new Set<string>();
    return (recent.data ?? []).filter((meal) => {
      const key = (meal.raw_text_input ?? meal.dish_id ?? meal.id).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [recent.data]);
  const matchingRecents = recents.filter((meal) => matchesLibrarySearch(query, dishName(meal))).slice(0, searching ? 5 : 8);
  const matchingDishes = (dishes.data ?? [])
    .filter((d) => (!favoritesOnly || d.is_favorite) && matchesLibrarySearch(query, `${d.name} ${d.name_local ?? ""}`))
    .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite))
    .slice(0, searching || favoritesOnly ? 12 : 6);
  const matchingMeals = searching ? (savedMeals.data ?? []).filter((meal) => matchesLibrarySearch(query, meal.name)).slice(0, 4) : [];
  const matchingCatalog = useMemo(() => (catalog && (searching || category) ? searchCatalog(catalog, query, category) : []), [catalog, query, category, searching]);

  let basketCalories: number | null = null;
  try { basketCalories = basketTotals(basket).calories; } catch { /* Shown as "check amounts" in the sheet. */ }

  function timestamp() {
    // On today's diary an untouched time means "now", not when the page opened.
    if (!timeEdited && initialDay === localDateISO()) return new Date().toISOString();
    return logTimestamp(when);
  }
  function logEntry(input: Omit<ManualMealInput, "id" | "user_id" | "logged_at" | "meal_type">, stay: boolean) {
    try {
      if (!session) throw new Error("Sign in to log food.");
      const row: ManualMealInput = { id: crypto.randomUUID(), user_id: session.user.id, logged_at: timestamp(), meal_type: mealType, ...input };
      add.mutate(row);
      toast(`${Math.round(row.calories)} cal added to ${mealLabel}`, { label: "Undo", onClick: () => del.mutate({ row: row as unknown as Meal }) });
      if (!stay) { setSheetOpen(false); router.push(`/?date=${when.slice(0, 10)}`); }
    } catch (e) { toast(errorMessage(e)); }
  }
  function logFood(food: CatalogFood, grams: number, dish: Dish | undefined, stay: boolean) {
    try {
      const nutrition = nutritionInput(catalogNutrition(food, grams));
      logEntry({
        ...nutrition,
        raw_text_input: `${measuredFoodName(food.name, grams)}${food.estimated && !dish ? " (estimate)" : ""}`,
        ...(isZeroPointFood(food) ? { points: 0 } : {}),
        ...(dish ? { dish_id: dish.id, portion_ratio: grams / Number(dish.reference_serving_g ?? 100) } : {}),
      }, stay);
    } catch (e) { toast(errorMessage(e)); }
  }
  function logQuick(entry: QuickEntry, stay: boolean) {
    try { logEntry({ ...nutritionInput(entry.values), raw_text_input: entry.name, ...(entry.points === 0 ? { points: 0 } : {}) }, stay); }
    catch (e) { toast(errorMessage(e)); }
  }
  function logSaved(meal: SavedMeal) {
    try {
      if (!session) throw new Error("Sign in to log a saved meal.");
      const input = logSavedMeal(meal, session.user.id, "1", !timeEdited && initialDay === localDateISO() ? localDateTime() : when, mealType);
      copy.mutate(input);
      toast(`${meal.name} added to ${mealLabel}`, { label: "Undo", onClick: () => input.rows.forEach((row) => del.mutate({ row })) });
    } catch (e) { toast(errorMessage(e)); }
  }
  function addToBasket(item: BasketPortion) {
    setBasket((items) => (items.length < 100 ? [...items, item] : items));
    setSheetOpen(false);
    toast("Added to your meal", { label: "Review", onClick: () => setBasketOpen(true) });
  }
  const defaultGrams = (food: CatalogFood) => food.portions[0]?.grams ?? 100;
  const foodSubtitle = (food: CatalogFood) => {
    const grams = defaultGrams(food);
    return `${Math.round(food.nutrition.calories * grams / 100)} cal · ${food.portions[0]?.label ?? "100 g"}${food.estimated ? " · estimate" : ""}`;
  };
  const savedCalories = (meal: SavedMeal) => {
    try { return Math.round(parseSavedFoods(meal.foods).reduce((sum, food) => sum + food.calories, 0)); } catch { return 0; }
  };
  const whenDate = new Date(when);
  const timeLabel = `${initialDay === localDateISO() ? "Today" : whenDate.toLocaleDateString([], { day: "numeric", month: "short" })} · ${whenDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between pt-1">
        <BackButton />
        <h1 className="text-base font-bold">Log food</h1>
        <button type="button" aria-expanded={timeOpen} aria-label={`Meal time: ${timeLabel}. Change`} className="press flex h-10 items-center gap-1.5 rounded-full bg-card px-3 text-xs font-semibold shadow-soft ring-1 ring-black/[0.04]" onClick={() => setTimeOpen(!timeOpen)}>
          <Clock className="size-3.5 text-muted-foreground" />
          {timeLabel}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {timeOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
            <Input className="bg-card shadow-soft" aria-label="When did you eat?" type="datetime-local" max={localDateTime()} value={when} onChange={(e) => { if (e.target.value) { setWhen(e.target.value); setTimeEdited(true); } }} />
          </motion.div>
        )}
      </AnimatePresence>

      <Segmented label="Meal" options={MEAL_OPTIONS} value={mealType as (typeof MEAL_OPTIONS)[number]["value"]} onChange={setMealType} className="bg-card shadow-soft ring-1 ring-black/[0.04]" />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-14 rounded-full bg-card pr-12 pl-12 text-base shadow-soft ring-1 ring-black/[0.04]"
          aria-label="Search foods, dishes and meals"
          placeholder="Search jollof, banana, oats…"
          autoFocus
          enterKeyHint="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setLimit(20); }}
        />
        {query && (
          <button type="button" aria-label="Clear search" className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-muted" onClick={() => setQuery("")}>
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
        <Chip onClick={() => show({ kind: "quick", key: crypto.randomUUID(), name: query.trim() || undefined })}><Zap className="size-3.5 fill-carbs text-carbs" />Quick add</Chip>
        <Chip selected={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}><Star className={`size-3.5 ${favoritesOnly ? "fill-current" : ""}`} />Favorites</Chip>
        <Link href={`/meals?date=${initialDay}`} className="press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 text-sm font-medium shadow-soft ring-1 ring-black/[0.04]"><Bookmark className="size-3.5" />Saved meals</Link>
        {CATALOG_CATEGORIES.map((name) => <Chip key={name} selected={category === name} onClick={() => { setCategory(category === name ? "" : name); setLimit(20); }}>{name}</Chip>)}
      </div>
      {draft.error && <p role="alert" className="text-sm text-destructive">{draft.error}</p>}

      {!favoritesOnly && !category && matchingRecents.length > 0 && (
        <Section title={searching ? "From your history" : "Recent"}>
          {matchingRecents.map((meal) => (
            <Row
              key={meal.id}
              title={dishName(meal)}
              subtitle={`${Math.round(Number(meal.calories))} cal · ${new Date(meal.logged_at).toLocaleDateString([], { day: "numeric", month: "short" })}`}
              quickLabel={`Log ${dishName(meal)} again`}
              onOpen={() => show({ kind: "quick", key: meal.id, repeat: meal, name: dishName(meal) })}
              onQuick={() => logQuick({ name: dishName(meal), values: repeatNutrition(meal, "1"), points: meal.points }, true)}
            />
          ))}
        </Section>
      )}

      {!category && matchingMeals.length > 0 && (
        <Section title="Saved meals">
          {matchingMeals.map((meal) => (
            <Row key={meal.id} title={meal.name} subtitle={`${savedCalories(meal)} cal · saved meal`} quickLabel={`Log ${meal.name}`} onOpen={() => router.push(`/meals?date=${initialDay}`)} onQuick={() => logSaved(meal)} />
          ))}
        </Section>
      )}

      {!category && matchingDishes.length > 0 && (
        <Section title={favoritesOnly ? "Favorites" : "My dishes"}>
          {matchingDishes.map((dish) => {
            const food = savedDishCatalogFood(dish);
            return (
              <Row
                key={dish.id}
                title={dish.name}
                subtitle={foodSubtitle(food)}
                icon={dish.is_favorite ? <Star className="size-4 shrink-0 fill-carbs text-carbs" /> : undefined}
                quickLabel={`Log one serving of ${dish.name}`}
                onOpen={() => show({ kind: "food", key: dish.id, food, dish })}
                onQuick={() => logFood(food, defaultGrams(food), dish, true)}
              />
            );
          })}
        </Section>
      )}
      {favoritesOnly && !matchingDishes.length && !dishes.isLoading && (
        <p className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-soft">No favorites yet. Open a dish and tap the star.</p>
      )}

      {!favoritesOnly && (searching || category) && (
        catalog === null ? <Skeleton className="h-40 w-full rounded-3xl" /> : matchingCatalog.length > 0 ? (
          <>
            <Section title={category || "Catalog"}>
              {matchingCatalog.slice(0, limit).map((food) => (
                <Row
                  key={food.id}
                  title={food.name}
                  subtitle={foodSubtitle(food)}
                  quickLabel={`Log ${food.portions[0]?.label ?? "100 g"} of ${food.name}`}
                  onOpen={() => show({ kind: "food", key: food.id, food })}
                  onQuick={() => logFood(food, defaultGrams(food), undefined, true)}
                />
              ))}
            </Section>
            {matchingCatalog.length > limit && (
              <button type="button" className="press w-full rounded-full bg-card py-3 text-sm font-semibold shadow-soft ring-1 ring-black/[0.04]" onClick={() => setLimit(limit + 30)}>
                Show more · {(matchingCatalog.length - limit).toLocaleString()} left
              </button>
            )}
          </>
        ) : searching && !matchingDishes.length && !matchingRecents.length && !matchingMeals.length && (
          <div className="space-y-3 rounded-3xl bg-card p-6 text-center shadow-soft">
            <p className="text-sm text-muted-foreground">Nothing matches “{query.trim()}”.</p>
            <button type="button" className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-5 text-sm font-semibold text-background" onClick={() => show({ kind: "quick", key: crypto.randomUUID(), name: query.trim() })}>
              <Zap className="size-4" />Quick add “{query.trim()}”
            </button>
          </div>
        )
      )}

      {!searching && !category && !favoritesOnly && (recent.isLoading || dishes.isLoading) && <Skeleton className="h-48 w-full rounded-3xl" />}
      {!searching && !category && !favoritesOnly && !recent.isLoading && !dishes.isLoading && !matchingRecents.length && !matchingDishes.length && (
        <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">Search above, or pick a category. Foods you log will show up here for one-tap logging.</p>
      )}
      {(recent.isError || dishes.isError) && <p role="alert" className="text-sm text-destructive">{errorMessage(recent.error ?? dishes.error)}</p>}

      <AnimatePresence>
        {basket.length > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 300 }} className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-safe">
            <button type="button" disabled={basketPending} className="press pointer-events-auto mx-auto flex h-14 w-full max-w-sm items-center justify-between rounded-full bg-linear-to-b from-[oklch(0.34_0_0)] to-[oklch(0.14_0_0)] pr-2 pl-6 text-background shadow-float" onClick={() => setBasketOpen(true)}>
              <span className="text-sm font-semibold tabular-nums">{basket.length} {basket.length === 1 ? "food" : "foods"}{basketCalories !== null ? ` · ${Math.round(basketCalories)} cal` : ""}</span>
              <span className="rounded-full bg-background px-4 py-2 text-sm font-bold text-foreground">Review meal</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {sheet?.kind === "food" && (
        <FoodSheet
          key={sheet.key}
          food={sheet.food}
          dish={sheet.dish}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          mealLabel={mealLabel}
          basketCount={basket.length}
          onLog={(grams) => logFood(sheet.food, grams, sheet.dish, false)}
          onAdd={(grams) => addToBasket({ id: crypto.randomUUID(), food: sheet.food, grams: String(grams) })}
        />
      )}
      {sheet?.kind === "quick" && (
        <QuickAddSheet
          key={sheet.key}
          repeat={sheet.repeat}
          repeatName={sheet.name}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          mealLabel={mealLabel}
          basketCount={basket.length}
          onLog={(entry) => logQuick(entry, false)}
          onAdd={(entry) => { try { addToBasket(quickBasketPortion(entry.name, entry.values)); } catch (e) { toast(errorMessage(e)); } }}
        />
      )}
      <CatalogBasket open={basketOpen} onOpenChange={setBasketOpen} items={basket} onChange={setBasket} when={when} setWhen={setWhen} mealType={mealType} setMealType={setMealType} />
      {(add.isError || copy.isError) && <p role="alert" className="text-sm text-destructive">{errorMessage(add.error ?? copy.error)}</p>}
    </div>
  );
}
