"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, onlineManager } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, CalendarDays, ChevronRight, Pencil, Search, Trash2 } from "lucide-react";
import { useSavedMeals, useWriteSavedMeal } from "@/hooks/useSavedMeals";
import { useSession } from "@/components/Providers";
import AnimatedNumber from "@/components/AnimatedNumber";
import { Segmented } from "@/components/Chips";
import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import Stepper from "@/components/Stepper";
import { toast } from "@/components/Toaster";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { matchesLibrarySearch } from "@/lib/librarySearch";
import { parseSavedFoods, savedMealPreview, logSavedMeal, type SavedMeal } from "@/lib/savedMeals";
import { COPY_MEAL_KEY, type MealCopy } from "@/lib/copyMeal";
import { diaryDate, initialLogTime, localDateTime, MEAL_TYPES, type MealType } from "@/lib/tracking";
import { localDateISO, errorMessage } from "@/lib/utils";

const fieldLabel = "text-xs font-medium text-muted-foreground";
const NUTRIENT_COLORS = { protein_g: "text-protein", carbs_g: "text-carbs", fat_g: "text-fat", fiber_g: "text-fiber" } as const;

function LoadingRows() {
  return (
    <div role="status">
      <span className="sr-only">Loading saved meals…</span>
      <Card className="gap-0 p-0">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export default function SavedMealsPage() { return <Suspense fallback={<LoadingRows />}><MealLibrary /></Suspense>; }

function MealLibrary() {
  const params = useSearchParams();
  const day = diaryDate(params.get("date"), localDateISO());
  const meals = useSavedMeals();
  const deletion = useWriteSavedMeal();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<SavedMeal | null>(null);
  const [open, setOpen] = useState(false);
  // Keep the last snapshot so the sheet can animate out after a delete.
  const current = picked && (meals.data?.find(meal => meal.id === picked.id) ?? picked);
  const matching = (meals.data ?? []).filter(meal => {
    let ingredients = "";
    try { ingredients = parseSavedFoods(meal.foods).map(food => food.name).join(" "); } catch { /* Keep malformed templates accessible by name for correction/deletion. */ }
    return matchesLibrarySearch(search, `${meal.name} ${ingredients}`);
  });

  function remove(row: SavedMeal) {
    setOpen(false);
    deletion.mutate({ operation: "delete", row });
    toast(
      onlineManager.isOnline() ? `Deleted “${row.name}”` : `“${row.name}” will be deleted when you reconnect`,
      { label: "Undo", onClick: () => deletion.mutate({ operation: "add", row }) },
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Saved meals"
        subtitle="Your usual combinations, ready to log again."
        back
        action={
          <Button asChild variant="secondary" className="bg-card shadow-soft">
            <Link href={`/?date=${day}`}><CalendarDays /> Diary</Link>
          </Button>
        }
      />

      <div className="relative">
        <Label htmlFor="saved-meal-search" className="sr-only">Find a saved meal or ingredient</Label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input id="saved-meal-search" type="search" className="bg-card pl-12 shadow-soft" placeholder="Search meals or ingredients" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {meals.isLoading && <LoadingRows />}
      {meals.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(meals.error)}</p>}
      {deletion.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(deletion.error)}</p>}

      {!meals.isLoading && !meals.isError && !matching.length && (
        <Card className="items-center gap-3 px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted"><Bookmark className="size-5" /></span>
          <p className="text-sm text-muted-foreground">
            {meals.data?.length ? "No meals match that search." : "No saved meals yet. In the diary, tap ⋯ on a meal and save it."}
          </p>
        </Card>
      )}

      {matching.length > 0 && (
        <Card className="relative gap-0 p-0">
          <ul className="divide-y divide-black/[0.05]">
            <AnimatePresence mode="popLayout">
              {matching.map((meal, index) => (
                <motion.li
                  key={meal.id}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.025 }}
                  className="bg-card"
                >
                  <MealRow meal={meal} onOpen={() => { setPicked(meal); setOpen(true); }} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Card>
      )}

      {current && (
        <MealSheet
          key={`${current.id}-${day}`}
          meal={current}
          day={day}
          open={open}
          onOpenChange={setOpen}
          deleting={deletion.isPending && !deletion.isPaused}
          onDelete={remove}
        />
      )}
    </div>
  );
}

function MealRow({ meal, onOpen }: { meal: SavedMeal; onOpen: () => void }) {
  let foods: ReturnType<typeof parseSavedFoods> | null = null;
  try { foods = parseSavedFoods(meal.foods); } catch { /* Shown as needing attention; details are in the sheet. */ }
  return (
    <button type="button" className="press flex w-full items-center gap-3 px-4 py-3.5 text-left" onClick={onOpen}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-fat/15 text-fat"><Bookmark className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{meal.name}</span>
        {foods
          ? <span className="block truncate text-xs text-muted-foreground capitalize">{meal.meal_type === "uncategorized" ? "" : `${meal.meal_type} · `}{foods.length} {foods.length === 1 ? "food" : "foods"}</span>
          : <span className="block truncate text-xs text-destructive">Needs attention</span>}
      </span>
      {foods && (
        <span className="shrink-0 text-right">
          <span className="block text-lg leading-tight font-extrabold tabular-nums">{Math.round(foods.reduce((sum, food) => sum + food.calories, 0))}</span>
          <span className="block text-[10px] text-muted-foreground">cal</span>
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
    </button>
  );
}

function MealSheet({ meal, day, open, onOpenChange, onDelete, deleting }: { meal: SavedMeal; day: string; open: boolean; onOpenChange: (open: boolean) => void; onDelete: (meal: SavedMeal) => void; deleting: boolean }) {
  const session = useSession();
  const router = useRouter();
  const write = useWriteSavedMeal();
  const copy = useMutation<void, Error, MealCopy>({ mutationKey: COPY_MEAL_KEY });
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(meal.name);
  const [amount, setAmount] = useState("1");
  const [when, setWhen] = useState(() => initialLogTime(day));
  const [type, setType] = useState(meal.meal_type as MealType);
  const [error, setError] = useState("");
  const formId = `log-meal-${meal.id}`;
  let invalid = "";
  try { parseSavedFoods(meal.foods); } catch (e) { invalid = errorMessage(e); }
  let preview: ReturnType<typeof savedMealPreview> | null = null;
  try { preview = savedMealPreview(meal.foods, amount); } catch { /* Invalid input stays editable; logging is disabled. */ }
  // "Other" is only offered for meals that were saved without a category.
  const typeOptions = MEAL_TYPES.filter(option => option !== "uncategorized" || meal.meal_type === "uncategorized")
    .map(option => ({ value: option, label: option === "uncategorized" ? "Other" : option }));

  function log() {
    try {
      if (!session) throw new Error("Sign in to log a saved meal.");
      const input = logSavedMeal(meal, session.user.id, amount, when, type);
      setError("");
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        toast(onlineManager.isOnline() ? `Logged “${meal.name}”` : `Logged “${meal.name}” — syncs when you reconnect`);
        router.push(`/?date=${when.slice(0, 10)}`);
      };
      copy.mutate(input, { onSuccess: done });
      if (!onlineManager.isOnline()) done();
    } catch (e) { setError(errorMessage(e)); }
  }

  function rename() {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      setRenaming(false);
      toast("Name saved");
    };
    write.mutate({ operation: "update", row: { ...meal, name } }, { onSuccess: done });
    if (!onlineManager.isOnline()) done();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={meal.name}
      description={preview ? `${preview.foods.length} ${preview.foods.length === 1 ? "food" : "foods"}` : undefined}
      footer={
        <Button type="submit" form={formId} size="lg" className="w-full" disabled={!preview || !!invalid || (copy.isPending && !copy.isPaused)}>
          Log meal
        </Button>
      }
    >
      {invalid && <p role="alert" className="text-sm text-destructive">{invalid}</p>}

      <form id={formId} className="space-y-5" onSubmit={e => { e.preventDefault(); log(); }}>
        {preview && (
          <div className="space-y-4 rounded-3xl bg-muted/50 p-4" aria-live="polite">
            <div className="text-center">
              <p className="text-5xl font-extrabold tracking-tight tabular-nums"><AnimatedNumber value={Math.round(preview.calories)} /></p>
              <p className="text-xs font-medium text-muted-foreground">calories in total</p>
            </div>
            <dl className="grid grid-cols-4 gap-2 text-center">
              {preview.nutrients.map(({ key, total, missing }) => (
                <div key={key} className="rounded-2xl bg-card px-1 py-2.5">
                  <dd className="text-sm font-extrabold tabular-nums">
                    {missing === preview.foods.length ? "Unknown" : `${Number(total.toFixed(1))} g${missing ? " known" : ""}`}
                    {missing > 0 && <span className="block text-[10px] font-normal text-muted-foreground">{missing} {missing === 1 ? "food missing" : "foods missing"}</span>}
                  </dd>
                  <dt className={`text-[11px] font-semibold capitalize ${NUTRIENT_COLORS[key]}`}>{key.replace("_g", "")}</dt>
                </div>
              ))}
            </dl>
            <ul className="space-y-1.5 text-sm">
              {preview.foods.map((food, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words">{food.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{Math.round(food.calories)} cal</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <p className={fieldLabel}>Portions · 1 is the saved amount</p>
          <Stepper label="Saved portions" value={amount} onChange={setAmount} step={0.5} unit="×" />
          {!preview && !invalid && <p role="alert" className="text-sm text-destructive">Enter a valid positive portion amount.</p>}
        </div>

        <div className="space-y-2">
          <p className={fieldLabel}>Meal category</p>
          <Segmented label="Meal category" options={typeOptions} value={type} onChange={setType} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`time-${meal.id}`} className={fieldLabel}>Date and time</Label>
          <Input id={`time-${meal.id}`} required type="datetime-local" max={localDateTime()} value={when} onChange={e => setWhen(e.target.value)} />
        </div>
      </form>

      {(error || copy.isError || write.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(copy.error ?? write.error)}</p>}

      <AnimatePresence initial={false}>
        {renaming && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="-mx-1 overflow-hidden px-1"
            onSubmit={e => { e.preventDefault(); rename(); }}
          >
            <div className="space-y-1.5 py-1">
              <Label htmlFor={`name-${meal.id}`} className={fieldLabel}>Rename meal</Label>
              <div className="flex gap-2">
                <Input id={`name-${meal.id}`} required maxLength={120} value={name} onChange={e => setName(e.target.value)} />
                <Button variant="secondary" className="h-12 shrink-0" disabled={write.isPending && !write.isPaused}>Save name</Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-1 text-center">
        <div className="flex justify-center gap-1">
          <Button type="button" variant="ghost" className="text-muted-foreground" aria-expanded={renaming} onClick={() => { setRenaming(!renaming); setName(meal.name); }}>
            <Pencil /> Rename
          </Button>
          <Button type="button" variant="ghost" className="text-destructive" disabled={deleting || (write.isPending && !write.isPaused)} onClick={() => onDelete(meal)}>
            <Trash2 /> Delete
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Deleting leaves logged foods in your diary.</p>
      </div>
    </Sheet>
  );
}
