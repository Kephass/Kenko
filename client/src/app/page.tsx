"use client";

import { Suspense, useState } from "react";
import { onlineManager } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Flame, Ruler, GlassWater, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProgressRing from "@/components/ProgressRing";
import ActivityRings from "@/components/ActivityRings";
import MacroInputs from "@/components/MacroInputs";
import { smartFoodPoints, dayPoints, pointsBudget, mealPoints } from "@/lib/points";
import WeekStrip, { weekStripDays } from "@/components/WeekStrip";
import CopyMeal from "@/components/CopyMeal";
import EmptyState from "@/components/EmptyState";
import { MACROS } from "@/lib/macros";
import { useProfile } from "@/hooks/useProfile";
import { useTargetHistory } from "@/hooks/useTargetHistory";
import { diaryDate, localDateTime, logTimestamp, nutrientInputValue, formatNutrient, hasMissingNutrients, nutritionInput, MEAL_TYPES } from "@/lib/tracking";
import type { Tables } from "@/lib/types";
import { errorMessage, formatDate, formatTime, localDateISO } from "@/lib/utils";
import { useWeeklyBalance } from "@/hooks/useWeeklyBalance";
import {
  useDeleteMealLog,
  useRestoreMealLog,
  useLogStreak,
  useMealLogsForDay,
  useUpdateMealLog,
} from "@/hooks/useMealLogs";
import { useDailySummary } from "@/hooks/useDailySummary";
import { useSession } from "@/components/Providers";
import { useWaterPreferences } from "@/hooks/useWaterPreferences";
import { formatWater } from "@/lib/waterUnits";
import QuickWater from "@/components/QuickWater";
import { useWaterForDay, waterTotal } from "@/hooks/useWaterLogs";
import { useLatestMeasurement } from "@/hooks/useMeasurements";

function MacroCard({
  left,
  label,
  ratio,
  colorClass,
  Icon,
  knownAmount,
}: {
  knownAmount?: number;
  left: number;
  label: string;
  ratio: number;
  colorClass: string;
  Icon: LucideIcon;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div>
        <p className="text-lg font-extrabold tabular-nums">{knownAmount === undefined ? Math.max(0, Math.round(left)) : Math.round(knownAmount)}g</p>
        <p className="text-xs text-muted-foreground">{label} {knownAmount === undefined ? "left" : "known"}</p>
      </div>
      <ProgressRing value={ratio} size={56} stroke={6} className={colorClass}>
        <span className={`flex size-7 items-center justify-center rounded-full bg-current/10 ${colorClass}`}>
          <Icon className="size-3.5" />
        </span>
      </ProgressRing>
    </Card>
  );
}

function MealCard({
  meal,
  onDeleted,
}: {
  onDeleted: (meal: Tables<"meal_logs">) => void;
  meal: Tables<"meal_logs">;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const update = useUpdateMealLog();
  const del = useDeleteMealLog();
  const [error, setError] = useState("");

  if (!editing) {
    return (
      <Card
        className="flex-row items-center justify-between p-4"
        onClick={() => setEditing(true)}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${meal.raw_text_input || "meal"}`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); } }}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-muted">
            <Flame className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">{meal.raw_text_input || "Meal"}</p>
            <p className="text-sm tabular-nums">{Math.round(Number(meal.calories))} calories · {mealPoints(meal)} pts</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              Protein {formatNutrient(meal.protein_g)} · Carbs {formatNutrient(meal.carbs_g)} · Fat {formatNutrient(meal.fat_g)}
            </p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{formatTime(meal.logged_at)}</span>
      </Card>
    );
  }

  const current = values ?? {
    name: meal.raw_text_input ?? "",
    meal_type: meal.meal_type ?? "uncategorized",
    when: localDateTime(new Date(meal.logged_at)),
    calories: String(Number(meal.calories)),
    protein: nutrientInputValue(meal.protein_g),
    carbs: nutrientInputValue(meal.carbs_g),
    fat: nutrientInputValue(meal.fat_g),
    fiber: nutrientInputValue(meal.fiber_g),
  };

  return (
    <Card className="space-y-3 p-4">
      <Input aria-label="Meal name" value={current.name} onChange={(e) => setValues({ ...current, name: e.target.value })} />
      <Input aria-label="Meal date and time" type="datetime-local" max={localDateTime()} value={current.when} onChange={(e) => setValues({ ...current, when: e.target.value })} />
      <select aria-label="Meal category" className="h-10 rounded-md border px-3 capitalize" value={current.meal_type} onChange={(e) => setValues({ ...current, meal_type: e.target.value })}>{MEAL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
      <div className="flex items-center gap-2">
        <Input
          className="h-10 w-24 border-0 bg-muted/60 text-lg font-extrabold tabular-nums shadow-none"
          type="number"
          inputMode="decimal"
          min="0" step="any" aria-label="Calories"
          value={current.calories}
          onChange={(e) => setValues({ ...current, calories: e.target.value })}
        />
        <span className="text-sm font-semibold text-muted-foreground">cal</span>
      </div>
      <MacroInputs values={current} onChange={(key, value) => setValues({ ...current, [key]: value })} />
      <div className="flex gap-2">
        <Button
          className="h-10 flex-1 rounded-full"
          disabled={update.isPending}
          onClick={() => {
            try {
              const nutrition = nutritionInput(current);
              const edits = { ...nutrition, points: smartFoodPoints(nutrition), raw_text_input: current.name.trim() || null, logged_at: logTimestamp(current.when), meal_type: current.meal_type };
              setError("");
              update.mutate({ row: meal, edits }, { onSuccess: () => { setEditing(false); setValues(null); } });
              if (!onlineManager.isOnline()) { setEditing(false); setValues(null); }
            } catch (e) { setError(errorMessage(e)); }
          }}
        >
          Save
        </Button>
        <Button
          variant="secondary"
          className="h-10 flex-1 rounded-full bg-muted/60"
          onClick={() => {
            setEditing(false);
            setValues(null);
          }}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          className="h-10 rounded-full px-4"
          disabled={del.isPending}
          onClick={() => { onDeleted(meal); del.mutate({ row: meal }); }}
        >
          Delete
        </Button>
      </div>
      {(error || update.isError || del.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(update.error || del.error)}</p>}
    </Card>
  );
}

export default function Dashboard() {
  return <Suspense fallback={<p role="status">Loading diary…</p>}><DatedDiary /></Suspense>;
}
function DatedDiary() {
  const params = useSearchParams();
  const day = diaryDate(params.get("date"), localDateISO());
  return <Diary key={day} initialDay={day} />;
}
function Diary({ initialDay }: { initialDay: string }) {
  const today = localDateISO();
  const router = useRouter();
  const [selectedDay, setSelectedDayState] = useState(initialDay);
  function setSelectedDay(value: string) {
    const day = diaryDate(value, today);
    setSelectedDayState(day);
    router.replace(`/?date=${day}`, { scroll: false });
  }
  const isToday = selectedDay === today;
  const [deletedMeal, setDeletedMeal] = useState<Tables<"meal_logs"> | null>(null);
  const restore = useRestoreMealLog();

  const balance = useWeeklyBalance();
  const profile = useProfile();
  const meals = useMealLogsForDay(selectedDay);
  const water = useWaterForDay(selectedDay);
  const session = useSession();
  const { preferences: waterPreferences } = useWaterPreferences(session?.user.id);
  const latestMeasurement = useLatestMeasurement();
  const streak = useLogStreak();

  // Fetch range derives from the strip's own window so the two can't drift.
  const weekStart = localDateISO(weekStripDays()[0]);
  const week = useDailySummary(weekStart, today);

  const confirmed = (meals.data ?? []).filter((m) => m.confirmed);
  const eaten = confirmed.reduce(
    (acc, m) => ({
      calories: acc.calories + Number(m.calories ?? 0),
      protein: acc.protein + Number(m.protein_g ?? 0),
      carbs: acc.carbs + Number(m.carbs_g ?? 0),
      fat: acc.fat + Number(m.fat_g ?? 0),
      fiber: acc.fiber + Number(m.fiber_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );

  const targetHistory = useTargetHistory(selectedDay < weekStart ? selectedDay : weekStart, today);
  const recordedGoals = targetHistory.forDay(selectedDay);
  const goals = recordedGoals ?? targetHistory.current;
  const caloriesLeft = Math.round(goals.calorieTarget - eaten.calories);
  const eatenPoints = dayPoints(confirmed);
  const pointsTarget = pointsBudget(goals.calorieTarget);
  const pointsLeft = pointsTarget - eatenPoints;
  const totalsPending = meals.isPending || profile.isPending || balance.isPending || (!isToday && targetHistory.isPending);
  const totalsFailed = meals.isError || profile.isError || balance.isError || (!isToday && targetHistory.isError);
  const totalsAvailable = !totalsPending && !totalsFailed;
  const waterMl = waterTotal(water.data);
  const lastMeasurement = latestMeasurement.data;
  const ratios = Object.fromEntries(
    (week.data ?? []).flatMap((r) => { const target = targetHistory.forDay(r.day); return target ? [[r.day, Number(r.calories) / target.calorieTarget]] : []; }),
  );

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-extrabold tracking-tight">
          Kenko <span className="align-middle text-xs font-medium text-muted-foreground">健康</span>
        </h1>
        {streak.data !== undefined && (
          <span aria-label={`${streak.data} day food logging streak`} title="Consecutive days with food logged" className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-sm font-semibold tabular-nums shadow-soft ring-1 ring-black/[0.04]">
            <Flame className="size-4 fill-carbs text-carbs" />
            {streak.data}
          </span>
        )}
      </header>

      {profile.isSuccess && !profile.data && <Card className="gap-3 p-5"><h2 className="font-bold">Welcome. Start with food and water.</h2><p className="text-sm text-muted-foreground">Choose your daily targets, or log your first entry with the current defaults.</p><Link href="/onboarding" className="font-semibold underline">Set up my targets</Link></Card>}
      <label className="block space-y-1 text-xs text-muted-foreground">Diary date<input aria-label="Diary date" type="date" max={today} value={selectedDay} onChange={(e) => { if (e.target.value) setSelectedDay(e.target.value); }} className="block h-10 w-full rounded-xl border bg-card px-3 text-sm text-foreground" /></label>
      <WeekStrip selected={selectedDay} onSelect={setSelectedDay} ratios={ratios} />

      {targetHistory.isError && <p role="alert" className="text-xs text-destructive">Historical targets could not be loaded. Any available cached targets are shown; other comparisons use current targets.</p>}
      {!totalsAvailable ? <Card className="p-6">
        <p role="status" className="text-lg font-semibold">{totalsFailed ? "Food progress unavailable" : "Loading food progress…"}</p>
        <p className="text-sm text-muted-foreground">{totalsFailed ? "Food entries or targets could not be loaded. Your saved entries remain available below." : "Loading your entries and daily targets."}</p>
        {totalsFailed && <Button variant="secondary" onClick={() => { void meals.refetch(); void profile.refetch(); void balance.refetch(); void targetHistory.refetch(); }}>Retry food progress</Button>}
      </Card> : <>
      <Card className="flex-row items-center justify-between p-6">
        <div className="space-y-4">
          <div>
            <p className="flex items-center gap-2 text-4xl font-extrabold tabular-nums">
              <span className="inline-block size-2.5 rounded-full bg-carbs" aria-hidden />
              {Math.abs(caloriesLeft)}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{caloriesLeft >= 0 ? "Calories left" : "Calories over"}</p>
          </div>
          <div>
            <p className="flex items-center gap-2 text-4xl font-extrabold tabular-nums">
              <span className="inline-block size-2.5 rounded-full bg-water" aria-hidden />
              {Math.abs(pointsLeft)}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{pointsLeft >= 0 ? "Points left" : "Points over"}</p>
            <p className="text-xs text-muted-foreground">{eatenPoints} of {pointsTarget} pts · fruit & veg are 0</p>
          </div>
        </div>
        <ActivityRings
          size={136}
          stroke={15}
          gap={5}
          rings={[
            { value: eaten.calories / goals.calorieTarget, colorClass: "text-carbs", label: `Calories ${Math.round(eaten.calories)} of ${Math.round(goals.calorieTarget)}` },
            { value: pointsTarget ? eatenPoints / pointsTarget : 0, colorClass: "text-water", label: `Points ${eatenPoints} of ${pointsTarget}` },
          ]}
        >
          <Flame className="size-5 text-muted-foreground" />
        </ActivityRings>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{goals.isFallback ? "Starting target" : "Daily target"}: {Math.round(goals.calorieTarget)} cal</span>
        <Link href="/settings" className="underline">Edit targets</Link>
      </div>
      {!isToday && <p className="text-xs text-muted-foreground">{recordedGoals ? "Progress uses the last targets recorded on this day." : targetHistory.isPending ? "Loading historical targets…" : "No target snapshot is available for this day. Progress compares against current targets."}</p>}
      <div className="grid grid-cols-3 gap-3">
        {MACROS.map(({ key, label, colorClass, Icon }) => (
          <MacroCard
            key={key}
            left={goals[key] - eaten[key]}
            knownAmount={confirmed.some(meal => meal[`${key}_g`] === null) ? eaten[key] : undefined}
            label={label}
            ratio={eaten[key] / goals[key]}
            colorClass={colorClass}
            Icon={Icon}
          />
        ))}
      </div>

      {confirmed.some(hasMissingNutrients) && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Some entries have missing nutrients. Macro and fiber progress includes known values only; edit an entry to add missing label details.</p>}
      <p className="text-sm text-muted-foreground">Fiber: {Math.round(eaten.fiber * 10) / 10} / {goals.fiber} g{confirmed.some(meal => meal.fiber_g === null) ? " · known amounts only" : ""}</p>
      </> }
      <Link href={`/meals?date=${selectedDay}`} className="block text-center text-sm font-semibold underline">Saved meals</Link>
      <Link href={`/log?date=${selectedDay}`} className="flex h-12 items-center justify-center rounded-full bg-foreground font-semibold text-background">Log food</Link>
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/water?date=${selectedDay}`}>
          <Card className="flex-row items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-full bg-current/10 text-water">
              <GlassWater className="size-4.5" />
            </span>
            <div>
              <p className="font-extrabold tabular-nums">{water.isError ? "Unavailable" : water.isPending ? "Loading…" : formatWater(waterMl, waterPreferences.unit)}</p>
              <p className="text-xs text-muted-foreground">of {formatWater(goals.water, waterPreferences.unit)}</p>
              <p className="text-xs text-muted-foreground">{isToday ? "Water today" : "Water"}</p>
            </div>
          </Card>
        </Link>
        <Link href="/measurements">
          <Card className="flex-row items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-full bg-muted">
              <Ruler className="size-4.5" />
            </span>
            <div>
              <p className="font-extrabold tabular-nums">
                {lastMeasurement ? `${Number(lastMeasurement.value_cm)} cm` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {lastMeasurement ? `Last ${lastMeasurement.measurement_type}` : "Measurements"}
              </p>
            </div>
          </Card>
        </Link>
      </div>

      <QuickWater key={selectedDay} day={selectedDay} />
      {water.isError && <p role="alert" className="text-sm text-destructive">Water total could not load. Open the water diary to retry.</p>}

      {deletedMeal && <div className="flex items-center justify-between rounded-xl bg-card p-3 text-sm" role="status">
        <span>Meal deleted.</span><Button size="sm" variant="secondary" onClick={() => { restore.mutate({ row: deletedMeal }); setDeletedMeal(null); }}>Undo</Button>
      </div>}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">
          {isToday ? "Recently eaten" : `Eaten ${formatDate(`${selectedDay}T00:00:00`)}`}
        </h2>
        {meals.isPending && <p role="status">Loading food diary…</p>}
        {meals.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(meals.error)}{meals.data ? " Showing previously saved entries." : ""}</p>}
        {meals.isSuccess && confirmed.length === 0 && (
          <EmptyState>
            {isToday ? "Nothing logged today. Tap + to log your first meal." : "Nothing logged this day."}
          </EmptyState>
        )}
        {!meals.isPending && MEAL_TYPES.map((type) => {
          const entries = confirmed.filter((meal) => (meal.meal_type ?? "uncategorized") === type);
          if ((type === "uncategorized" || meals.isError) && !entries.length) return null;
          return <div key={type} className="space-y-2">
            <div className="flex items-center justify-between pt-2 text-sm"><h3 className="font-bold capitalize">{type}</h3><span className="text-muted-foreground">{Math.round(entries.reduce((sum, m) => sum + Number(m.calories), 0))} cal</span></div>
            {entries.length > 0 && <CopyMeal rows={entries} type={type} />}
            {entries.length ? entries.map((meal) => <MealCard key={meal.id} meal={meal} onDeleted={setDeletedMeal} />) : <p className="text-xs text-muted-foreground">Nothing logged yet.</p>}
          </div>;
        })}
      </section>
    </div>
  );
}
