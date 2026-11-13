"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Ellipsis, Flame, Leaf, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import ProgressRing from "@/components/ProgressRing";
import ActivityRings from "@/components/ActivityRings";
import AnimatedNumber from "@/components/AnimatedNumber";
import WeekStrip, { weekStripDays } from "@/components/WeekStrip";
import CopyMeal from "@/components/CopyMeal";
import MealEditSheet from "@/components/MealEditSheet";
import QuickWater from "@/components/QuickWater";
import { dayPoints, pointsBudget, mealPoints, weekStartISO, weekPointsDays, weeklyPoints } from "@/lib/points";
import { MACROS } from "@/lib/macros";
import { MEAL_META } from "@/lib/mealMeta";
import { useProfile } from "@/hooks/useProfile";
import { useTargetHistory } from "@/hooks/useTargetHistory";
import { diaryDate, hasMissingNutrients, MEAL_TYPES, type MealType } from "@/lib/tracking";
import type { Tables } from "@/lib/types";
import { errorMessage, formatTime, localDateISO, addDays } from "@/lib/utils";
import { useWeeklyBalance } from "@/hooks/useWeeklyBalance";
import { useLogStreak, useMealLogsForDay, useMealLogsForRange } from "@/hooks/useMealLogs";
import { useDailySummary } from "@/hooks/useDailySummary";

type Meal = Tables<"meal_logs">;
const EASE = [0.16, 1, 0.3, 1] as const;
const grams = (value: number | null) => (value == null ? "–" : Math.round(value));

function MacroCard({ left, label, ratio, colorClass, Icon, knownAmount }: {
  knownAmount?: number;
  left: number;
  label: string;
  ratio: number;
  colorClass: string;
  Icon: LucideIcon;
}) {
  const over = knownAmount === undefined && left < 0;
  return (
    <Card className="gap-3 p-4">
      <ProgressRing value={ratio} size={52} stroke={6} className={over ? "text-destructive" : colorClass}>
        <span className={`flex size-7 items-center justify-center rounded-full bg-current/10 ${colorClass}`}>
          <Icon className="size-3.5" />
        </span>
      </ProgressRing>
      <div>
        <p className="text-xl font-extrabold tracking-tight tabular-nums">
          <AnimatedNumber value={knownAmount === undefined ? Math.abs(Math.round(left)) : Math.round(knownAmount)} />
          <span className="text-sm font-bold text-muted-foreground">g</span>
        </p>
        <p className="text-xs text-muted-foreground">{label} {knownAmount !== undefined ? "known" : over ? "over" : "left"}</p>
      </div>
    </Card>
  );
}

function MealGroup({ type, entries, day, onEdit }: { type: MealType; entries: Meal[]; day: string; onEdit: (meal: Meal) => void }) {
  const { label, Icon } = MEAL_META[type];
  const [actions, setActions] = useState(false);
  const total = Math.round(entries.reduce((sum, meal) => sum + Number(meal.calories), 0));
  return (
    <Card className="gap-0 p-0">
      <div className="flex items-center gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">{label}</h3>
          <p className="text-xs text-muted-foreground tabular-nums">{entries.length ? `${total} cal · ${dayPoints(entries)} pts` : "Nothing yet"}</p>
        </div>
        {entries.length > 0 && (
          <button type="button" aria-label={`${label} options: save or copy`} className="press flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" onClick={() => setActions(true)}>
            <Ellipsis className="size-5" />
          </button>
        )}
        <Link href={`/log?date=${day}&meal=${type}`} aria-label={`Add food to ${label}`} className="press flex size-9 items-center justify-center rounded-full bg-muted text-foreground">
          <Plus className="size-4.5" strokeWidth={2.4} />
        </Link>
      </div>
      <AnimatePresence initial={false}>
        {entries.map((meal) => (
          <motion.button
            key={meal.id}
            type="button"
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            aria-label={`Edit ${meal.raw_text_input || "meal"}`}
            className="block w-full overflow-hidden text-left active:bg-muted/60"
            onClick={() => onEdit(meal)}
          >
            <span className="flex items-center gap-3 border-t border-black/[0.05] px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{meal.raw_text_input || "Meal"}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  P {grams(meal.protein_g)} · C {grams(meal.carbs_g)} · F {grams(meal.fat_g)} · {formatTime(meal.logged_at)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-extrabold tabular-nums">{Math.round(Number(meal.calories))}</span>
                <span className="block text-[11px] text-muted-foreground tabular-nums">{mealPoints(meal)} pts</span>
              </span>
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
      {entries.length > 0 && <CopyMeal rows={entries} type={type} open={actions} onOpenChange={setActions} />}
    </Card>
  );
}

export default function Dashboard() {
  return <Suspense fallback={<DiarySkeleton />}><DatedDiary /></Suspense>;
}

function DiarySkeleton() {
  return (
    <div className="space-y-4" role="status">
      <span className="sr-only">Loading diary…</span>
      <Skeleton className="h-52 w-full rounded-3xl" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-3xl" />)}
      </div>
      <Skeleton className="h-36 w-full rounded-3xl" />
    </div>
  );
}

function DatedDiary() {
  const params = useSearchParams();
  const urlDay = diaryDate(params.get("date"), localDateISO());
  const router = useRouter();
  // Local state keeps taps instant; the URL follows and can also lead (links).
  const [view, setView] = useState({ day: urlDay, direction: 0, url: urlDay });
  if (urlDay !== view.url) setView({ day: urlDay, direction: urlDay > view.day ? 1 : -1, url: urlDay });
  function select(value: string) {
    const day = diaryDate(value, localDateISO());
    if (day === view.day) return;
    setView((current) => ({ ...current, day, direction: day > current.day ? 1 : -1 }));
    router.replace(`/?date=${day}`, { scroll: false });
  }
  return <Diary selectedDay={view.day} direction={view.direction} onSelect={select} />;
}

function Diary({ selectedDay, direction, onSelect }: { selectedDay: string; direction: number; onSelect: (day: string) => void }) {
  const today = localDateISO();
  const isToday = selectedDay === today;
  const [dateOpen, setDateOpen] = useState(false);
  const [editing, setEditing] = useState<Meal | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const selectedDate = new Date(`${selectedDay}T00:00:00`);
  const yesterday = localDateISO(addDays(new Date(`${today}T00:00:00`), -1));
  const dateLabel = isToday ? "Today" : selectedDay === yesterday ? "Yesterday" : selectedDate.toLocaleDateString([], { weekday: "long" });

  const balance = useWeeklyBalance();
  const profile = useProfile();
  const meals = useMealLogsForDay(selectedDay);
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

  const pointsWeekStart = weekStartISO(selectedDay);
  const targetHistory = useTargetHistory(pointsWeekStart < weekStart ? pointsWeekStart : weekStart, today);
  const recordedGoals = targetHistory.forDay(selectedDay);
  const goals = recordedGoals ?? targetHistory.current;
  const caloriesLeft = Math.round(goals.calorieTarget - eaten.calories);
  const eatenPoints = dayPoints(confirmed);
  const pointsTarget = pointsBudget(goals.calorieTarget);
  const pointsLeft = pointsTarget - eatenPoints;
  // Weeklies: earlier days come from the week query, the open day from live rows.
  const weekLogs = useMealLogsForRange(pointsWeekStart, selectedDay);
  const weeklies = weeklyPoints(
    weekPointsDays(weekLogs.data, selectedDay, (d) => pointsBudget((targetHistory.forDay(d) ?? targetHistory.current).calorieTarget))
      .map((d) => (d.day === selectedDay ? { ...d, budget: pointsTarget, spent: eatenPoints, logged: confirmed.length > 0 } : d)),
    selectedDay,
  );
  const pointsCovered = pointsLeft < 0 && weeklies.left >= 0;
  const totalsPending = meals.isPending || profile.isPending || balance.isPending || (!isToday && targetHistory.isPending);
  const totalsFailed = meals.isError || profile.isError || balance.isError || (!isToday && targetHistory.isError);
  const ratios = Object.fromEntries(
    (week.data ?? []).flatMap((r) => { const target = targetHistory.forDay(r.day); return target ? [[r.day, Number(r.calories) / target.calorieTarget]] : []; }),
  );
  // The selected day's ring tracks optimistic edits, not the last server rollup.
  if (!totalsPending && !totalsFailed) ratios[selectedDay] = eaten.calories / goals.calorieTarget;
  const fiberPartial = confirmed.some((meal) => meal.fiber_g === null);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between pt-1">
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="press text-left" aria-label={`Diary date: ${dateLabel}. Open calendar`}>
              <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {selectedDate.toLocaleDateString([], { weekday: "short", day: "numeric", month: "long" })}
              </span>
              <span className="flex items-center gap-1.5 text-3xl font-extrabold tracking-tight">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={dateLabel} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25, ease: EASE }}>
                    {dateLabel}
                  </motion.span>
                </AnimatePresence>
                <ChevronDown className="size-5 text-muted-foreground" strokeWidth={2.6} />
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-3xl p-1" align="start">
            <Calendar
              mode="single"
              required
              selected={selectedDate}
              defaultMonth={selectedDate}
              disabled={{ after: new Date(`${today}T00:00:00`) }}
              onSelect={(d) => { if (d) onSelect(localDateISO(d)); setDateOpen(false); }}
            />
          </PopoverContent>
        </Popover>
        {streak.data !== undefined && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 14, stiffness: 260, delay: 0.25 }}
            aria-label={`${streak.data} day food logging streak`}
            title="Consecutive days with food logged"
            className="flex items-center gap-1 rounded-full bg-card px-3 py-2 text-sm font-bold tabular-nums shadow-soft ring-1 ring-black/[0.04]"
          >
            <Flame className="size-4 fill-carbs text-carbs" />
            {streak.data}
          </motion.span>
        )}
      </header>

      <WeekStrip selected={selectedDay} onSelect={onSelect} ratios={ratios} />

      {profile.isSuccess && !profile.data && (
        <Link href="/onboarding" className="press block">
          <Card className="flex-row items-center gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-current/10 text-carbs"><Sparkles className="size-4.5" /></span>
            <div className="flex-1"><p className="font-bold">Set your targets</p><p className="text-xs text-muted-foreground">Takes a minute. Until then you’re on the defaults.</p></div>
          </Card>
        </Link>
      )}

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={selectedDay}
          custom={direction}
          variants={{
            enter: (d: number) => ({ opacity: 0, x: d * 28 }),
            center: { opacity: 1, x: 0 },
            exit: (d: number) => ({ opacity: 0, x: d * -28 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: EASE }}
          className="space-y-4"
        >
          {totalsPending ? <DiarySkeleton /> : totalsFailed ? (
            <Card className="gap-3 p-6">
              <p role="status" className="text-lg font-bold">Food progress unavailable</p>
              <p className="text-sm text-muted-foreground">Entries or targets could not be loaded. Saved entries remain below.</p>
              <Button variant="secondary" onClick={() => { void meals.refetch(); void profile.refetch(); void balance.refetch(); void targetHistory.refetch(); }}>Retry</Button>
            </Card>
          ) : <>
            <Card className="gap-5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">{caloriesLeft >= 0 ? "Calories left" : "Calories over"}</p>
                  <p className={`text-6xl leading-none font-extrabold tracking-tighter tabular-nums ${caloriesLeft < 0 ? "text-destructive" : ""}`}>
                    <AnimatedNumber value={Math.abs(caloriesLeft)} />
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                    {Math.round(eaten.calories).toLocaleString()} eaten ·{" "}
                    <Link href="/settings" className="font-semibold text-foreground underline decoration-foreground/20 underline-offset-2">
                      {Math.round(goals.calorieTarget).toLocaleString()} {goals.isFallback ? "starting goal" : "goal"}
                    </Link>
                  </p>
                </div>
                <ActivityRings
                  size={124}
                  stroke={14}
                  gap={5}
                  rings={[
                    { value: eaten.calories / goals.calorieTarget, colorClass: "text-carbs", label: `Calories ${Math.round(eaten.calories)} of ${Math.round(goals.calorieTarget)}` },
                    { value: pointsTarget ? eatenPoints / pointsTarget : 0, colorClass: "text-water", label: `Points ${eatenPoints} of ${pointsTarget}` },
                  ]}
                >
                  <Flame className="size-5 text-carbs" />
                </ActivityRings>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-muted/60 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`size-2 rounded-full ${pointsLeft >= 0 || pointsCovered ? "bg-water" : "bg-destructive"}`} aria-hidden />
                    {pointsLeft >= 0 ? "Points left" : pointsCovered ? "From weeklies" : "Points over"}
                  </p>
                  <p className="text-xl font-extrabold tabular-nums">
                    <AnimatedNumber value={Math.abs(pointsCovered || pointsLeft >= 0 ? pointsLeft : weeklies.left)} />
                    {(pointsCovered || pointsLeft >= 0) && <span className="text-xs font-semibold text-muted-foreground"> of {pointsTarget}</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                    {weekLogs.isPending ? "Weeklies…" : weekLogs.isError ? "Weeklies unavailable" : weeklies.left >= 0 ? `${weeklies.left} weekly left${weeklies.rolledOver ? ` · ${weeklies.rolledOver} rolled over` : ""}` : "Weeklies used up"}
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/60 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Leaf className="size-3 text-fiber" aria-hidden />
                    Fiber{fiberPartial ? " (known)" : ""}
                  </p>
                  <p className="text-xl font-extrabold tabular-nums">
                    <AnimatedNumber value={Math.round(eaten.fiber * 10) / 10} decimals={eaten.fiber % 1 ? 1 : 0} />
                    <span className="text-xs font-semibold text-muted-foreground"> of {goals.fiber} g</span>
                  </p>
                </div>
              </div>
            </Card>

            {!isToday && !recordedGoals && !targetHistory.isPending && <p className="px-1 text-xs text-muted-foreground">No saved targets for this day, so progress uses today’s.</p>}
            {targetHistory.isError && <p role="alert" className="px-1 text-xs text-destructive">Historical targets could not be loaded; using current targets.</p>}

            <div className="grid grid-cols-3 gap-3">
              {MACROS.map(({ key, label, colorClass, Icon }, index) => (
                <motion.div key={key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.05 * index }}>
                  <MacroCard
                    left={goals[key] - eaten[key]}
                    knownAmount={confirmed.some((meal) => meal[`${key}_g`] === null) ? eaten[key] : undefined}
                    label={label}
                    ratio={eaten[key] / goals[key]}
                    colorClass={colorClass}
                    Icon={Icon}
                  />
                </motion.div>
              ))}
            </div>
            {confirmed.some(hasMissingNutrients) && <p className="px-1 text-xs text-muted-foreground">Some entries are missing nutrients. Tap an entry to fill them in.</p>}
          </>}

          <QuickWater day={selectedDay} goalMl={goals.water} />

          <section className="space-y-3 pt-2" aria-label="Food diary">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-extrabold tracking-tight">Meals</h2>
              <Link href={`/meals?date=${selectedDay}`} className="press rounded-full bg-card px-3 py-1.5 text-xs font-semibold shadow-soft ring-1 ring-black/[0.04]">Saved meals</Link>
            </div>
            {meals.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(meals.error)}{meals.data ? " Showing previously saved entries." : ""}</p>}
            {meals.isPending ? <Skeleton className="h-20 w-full rounded-3xl" /> : MEAL_TYPES.map((type, index) => {
              const entries = confirmed.filter((meal) => (meal.meal_type ?? "uncategorized") === type);
              if ((type === "uncategorized" || meals.isError) && !entries.length) return null;
              return (
                <motion.div key={type} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.1 + 0.05 * index }}>
                  <MealGroup type={type} entries={entries} day={selectedDay} onEdit={(meal) => { setEditing(meal); setEditOpen(true); }} />
                </motion.div>
              );
            })}
          </section>
        </motion.div>
      </AnimatePresence>

      {editing && <MealEditSheet key={editing.id} meal={editing} open={editOpen} onOpenChange={setEditOpen} />}
    </div>
  );
}
