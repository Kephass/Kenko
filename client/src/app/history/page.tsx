"use client";

import { completenessMessage } from "@/lib/nutritionCompleteness";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { diaryDate } from "@/lib/tracking";
import { ArrowRight, Award, BarChart3, ChevronRight, Droplets, Flame, Lock, Ruler, Scale, Table2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import TrendChart from "@/components/TrendChart";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import AnimatedNumber from "@/components/AnimatedNumber";
import ProgressRing from "@/components/ProgressRing";
import Sheet from "@/components/Sheet";
import { MACROS } from "@/lib/macros";
import { useTargetHistory } from "@/hooks/useTargetHistory";
import { addDays, errorMessage, formatDate, localDateISO } from "@/lib/utils";
import { useDailySummary, summaryByDay } from "@/hooks/useDailySummary";
import { useLogStreak } from "@/hooks/useMealLogs";
import { weeklyInsights, achievements, nextAchievement } from "@/lib/insights";
import { useWeighIns } from "@/hooks/useWeighIns";
import { useWaterSummary } from "@/hooks/useWaterSummary";
import { useWaterPreferences } from "@/hooks/useWaterPreferences";
import { useSession } from "@/components/Providers";
import { formatWater } from "@/lib/waterUnits";
import { useMeasurements } from "@/hooks/useMeasurements";

const EASE = [0.16, 1, 0.3, 1] as const;
const grow = (index: number) => ({
  initial: { scaleY: 0 },
  animate: { scaleY: 1 },
  transition: { duration: 0.7, ease: EASE, delay: 0.25 + index * 0.018 },
} as const);

function Section({ index, className = "space-y-3", ...props }: React.ComponentProps<typeof motion.section> & { index: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: 0.05 + index * 0.06 }}
      className={className}
      {...props}
    />
  );
}

function ChartAxis({ start }: { start: string }) {
  return (
    <div className="flex justify-between text-[11px] font-medium text-muted-foreground" aria-hidden="true">
      <span>{formatDate(`${start}T00:00:00`)}</span>
      <span>Today</span>
    </div>
  );
}

/** Bars that grow from the baseline, with a stepped line for recorded targets. */
function Bars({ series, barClass = "bg-foreground" }: { series: { value: number; goal: number | null }[]; barClass?: string }) {
  const max = Math.max(1, ...series.flatMap(s => [s.value, s.goal ?? 0])) * 1.1;
  return (
    <div aria-hidden="true" className="flex h-32 items-end gap-[3px]">
      {series.map((s, i) => (
        <div key={i} className="relative h-full min-w-0 flex-1">
          <motion.div
            {...grow(i)}
            className={`absolute inset-x-0 bottom-0 origin-bottom rounded-t-full ${s.value > 0 ? barClass : "bg-foreground/10"}`}
            style={{ height: s.value > 0 ? `max(4px, ${(s.value / max) * 100}%)` : 3 }}
          />
          {s.goal !== null && <span className="absolute -inset-x-[1.5px] h-[1.5px] bg-foreground/30" style={{ bottom: `${(s.goal / max) * 100}%` }} />}
        </div>
      ))}
    </div>
  );
}

function MacroBars({ series }: { series: { protein: number; carbs: number; fat: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.protein + s.carbs + s.fat)) * 1.1;
  return (
    <div aria-hidden="true" className="flex h-32 items-end gap-[3px]">
      {series.map((s, i) => {
        const total = s.protein + s.carbs + s.fat;
        return (
          <div key={i} className="relative h-full min-w-0 flex-1">
            {total > 0 ? (
              <motion.div
                {...grow(i)}
                className="absolute inset-x-0 bottom-0 flex origin-bottom flex-col-reverse gap-px overflow-hidden rounded-t-full"
                style={{ height: `max(4px, ${(total / max) * 100}%)` }}
              >
                {MACROS.map(({ key, colorClass }) => <span key={key} className={`min-h-0 bg-current ${colorClass}`} style={{ flex: `${s[key]} 1 0%` }} />)}
              </motion.div>
            ) : (
              <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-foreground/10" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl bg-muted/70 px-3 py-2.5 ${className}`}>
      <p className="text-lg leading-tight font-extrabold tabular-nums">{children}</p>
      <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function TableButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="secondary" size="sm" aria-label={label} onClick={onClick}>
      <Table2 />
      View table
    </Button>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-5" role="status">
      <span className="sr-only">Loading history…</span>
      <PageHeader title="Progress" />
      <Skeleton className="h-64 rounded-3xl" />
      <Skeleton className="h-52 rounded-3xl" />
      <Skeleton className="h-52 rounded-3xl" />
    </div>
  );
}

export default function HistoryPage() {
  return <Suspense fallback={<HistorySkeleton />}><DatedHistory /></Suspense>;
}
function DatedHistory() {
  const params = useSearchParams();
  const day = diaryDate(params.get("date"), localDateISO());
  return <History initialDay={day} />;
}
function History({ initialDay }: { initialDay: string }) {
  const router = useRouter();
  const today = new Date();
  const todayIso = localDateISO(today);
  const [month, setMonth] = useState<Date>(() => new Date(`${initialDay}T00:00:00`));
  const [selected, setSelected] = useState<Date>(() => new Date(`${initialDay}T00:00:00`));
  // Follow ?date= changes without remounting, so the page doesn't re-animate.
  const [syncedDay, setSyncedDay] = useState(initialDay);
  if (syncedDay !== initialDay) {
    setSyncedDay(initialDay);
    setSelected(new Date(`${initialDay}T00:00:00`));
    setMonth(new Date(`${initialDay}T00:00:00`));
  }
  const [table, setTable] = useState<"food" | "water" | null>(null);
  const selectedIso = selected ? localDateISO(selected) : undefined;
  const session = useSession();
  const { preferences } = useWaterPreferences(session?.user.id);

  const monthStart = localDateISO(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = localDateISO(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const chartStart = localDateISO(addDays(today, -29));

  // One RPC covering both the visible month and the 30-day charts; the ranges
  // mostly overlap when viewing the current month.
  const summary = useDailySummary(
    chartStart < monthStart ? chartStart : monthStart,
    monthEnd > todayIso ? monthEnd : todayIso,
  );

  const water = useWaterSummary(chartStart < monthStart ? chartStart : monthStart, monthEnd > todayIso ? monthEnd : todayIso);
  const waterByDay = Object.fromEntries((water.data ?? []).map(row => [row.day, row]));
  const waterDays = (water.data ?? []).filter(row => row.day >= chartStart && row.day <= todayIso);
  const targets = useTargetHistory(chartStart, todayIso);
  const weighIns = useWeighIns();
  const measurements = useMeasurements();

  const byDay = summaryByDay(summary.data);
  const daySummary = selectedIso ? byDay[selectedIso] : undefined;
  const loggedDates = [...new Set([...(summary.data ?? []), ...(water.data ?? [])]
    .filter(r => r.day >= monthStart && r.day <= monthEnd).map(r => r.day))]
    .map(day => new Date(`${day}T00:00:00`));

  const series = Array.from({ length: 30 }, (_, i) => {
    const row = byDay[localDateISO(addDays(today, i - 29))];
    return {
      day: localDateISO(addDays(today, i - 29)),
      goal: targets.forDay(localDateISO(addDays(today, i - 29)))?.calorieTarget ?? null,
      mealCount: Number(row?.meal_count ?? 0),
      calories: Number(row?.calories ?? 0),
      protein: Number(row?.protein_g ?? 0),
      carbs: Number(row?.carbs_g ?? 0),
      fat: Number(row?.fat_g ?? 0),
      fiber: Number(row?.fiber_g ?? 0),
    };
  });
  const hasMeals = series.some((s) => s.mealCount > 0);
  const loggedSeries = series.filter((s) => s.mealCount > 0);
  const avgCalories30 = loggedSeries.length ? loggedSeries.reduce((sum, s) => sum + s.calories, 0) / loggedSeries.length : 0;

  const streak = useLogStreak();
  const waterMlByDay = Object.fromEntries((water.data ?? []).map((r) => [r.day, Number(r.amount_ml)]));
  const week = weeklyInsights(series, waterMlByDay, todayIso);
  const earned = achievements(streak.data ?? 0, series, targets.current.fiber);
  const upcoming = nextAchievement(earned);
  const waterSeries = series.map((s) => ({ value: waterMlByDay[s.day] ?? 0, goal: targets.forDay(s.day)?.water ?? null }));

  const latestWeight = weighIns.data?.[0];

  const measurementGroups = new Map<string, { value_cm: number; logged_at: string }[]>();
  for (const m of measurements.data ?? []) {
    const list = measurementGroups.get(m.measurement_type) ?? [];
    list.push({ value_cm: Number(m.value_cm), logged_at: m.logged_at });
    measurementGroups.set(m.measurement_type, list);
  }

  const incomplete = completenessMessage(daySummary);

  return (
    <div className="space-y-7">
      <PageHeader title="Progress" />

      {targets.isError && <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-xs text-destructive">Target history could not be loaded. Chart target marks may be incomplete.</p>}
      {summary.isError && <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage(summary.error)}</p>}

      <Section index={0} aria-labelledby="this-week-title">
        <div className="flex items-center justify-between px-1">
          <h2 id="this-week-title" className="text-lg font-extrabold tracking-tight">This week</h2>
          {(streak.data ?? 0) > 0 && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-carbs/15 px-2.5 text-xs font-semibold tabular-nums">
              <Flame className="size-3.5 text-carbs" aria-hidden="true" />
              {streak.data} day streak
            </span>
          )}
        </div>
        {summary.isLoading ? (
          <div role="status"><span className="sr-only">Loading food history…</span><Skeleton className="h-64 rounded-3xl" /></div>
        ) : week.loggedDays === 0 ? (
          <EmptyState icon={BarChart3}>No food logged in the last 7 days. Log a meal to start your weekly report.</EmptyState>
        ) : (
          <Card className="gap-5 p-5">
            <div>
              <p className="text-6xl leading-none font-extrabold tracking-tight tabular-nums"><AnimatedNumber value={week.avgCalories} /></p>
              <p className="mt-2 text-sm font-medium text-muted-foreground">Avg calories per logged day</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Days logged">
                <AnimatedNumber value={week.loggedDays} /><span className="text-sm font-semibold text-muted-foreground"> / 7</span>
              </Stat>
              <Stat label={week.vsTarget == null ? "No target" : week.vsTarget <= 0 ? "Under target" : "Over target"}>
                {week.vsTarget == null ? "—" : <AnimatedNumber value={Math.abs(week.vsTarget)} />}
              </Stat>
              <Stat label="Water">
                <AnimatedNumber value={week.totalWaterMl / 1000} decimals={1} /><span className="text-sm font-semibold text-muted-foreground"> L</span>
              </Stat>
            </div>
            {week.macroSplit && (
              <div className="space-y-2">
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                  {MACROS.map(({ key, colorClass }, i) => (
                    <motion.span
                      key={key}
                      className={`h-full origin-left rounded-full bg-current ${colorClass}`}
                      style={{ width: `${week.macroSplit![key]}%` }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.7, ease: EASE, delay: 0.3 + i * 0.08 }}
                    />
                  ))}
                </div>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
                  <span className="sr-only">Macro split: </span>
                  {MACROS.map(({ key, label, colorClass }) => (
                    <span key={key} className="inline-flex items-center gap-1.5">
                      <span className={`size-2 rounded-full bg-current ${colorClass}`} aria-hidden="true" />
                      {label} <span className="font-semibold text-foreground tabular-nums">{week.macroSplit![key]}%</span>
                    </span>
                  ))}
                </p>
              </div>
            )}
            <ul className="space-y-1.5 border-t border-black/[0.05] pt-4 text-sm text-muted-foreground">
              {week.callouts.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-foreground/25" aria-hidden="true" />
                  {c}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>

      <Section index={1} aria-labelledby="last-30-title">
        <h2 id="last-30-title" className="px-1 text-lg font-extrabold tracking-tight">Last 30 days</h2>
        {summary.isLoading || summary.isError ? null : hasMeals ? (
          <>
            <Card className="gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-3xl leading-none font-extrabold tabular-nums"><AnimatedNumber value={avgCalories30} /></p>
                  <p className="mt-1.5 text-xs font-medium text-muted-foreground">Avg calories · line marks your target</p>
                </div>
                <TableButton label="View daily nutrition values" onClick={() => setTable("food")} />
              </div>
              <Bars series={series.map((s) => ({ value: s.calories, goal: s.goal }))} />
              <ChartAxis start={chartStart} />
            </Card>
            <Card className="gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-bold">Macros <span className="text-xs font-medium text-muted-foreground">grams</span></p>
                <div className="flex gap-3">
                  {MACROS.map(({ key, label, colorClass }) => (
                    <span key={key} className={`flex items-center gap-1.5 text-xs ${colorClass}`}>
                      <span className="size-2 rounded-full bg-current" />
                      <span className="font-medium text-muted-foreground">{label}</span>
                    </span>
                  ))}
                </div>
              </div>
              <MacroBars series={series} />
              <ChartAxis start={chartStart} />
            </Card>
          </>
        ) : (
          <EmptyState icon={BarChart3}>No confirmed meals in the last 30 days yet.</EmptyState>
        )}

        <h3 id="water-history-title" className="sr-only">Water · last 30 days</h3>
        {water.isPending ? (
          <div role="status"><span className="sr-only">Loading water history…</span><Skeleton className="h-52 rounded-3xl" /></div>
        ) : water.isError ? (
          <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">Water history could not be loaded.</p>
        ) : waterDays.length === 0 ? (
          <EmptyState icon={Droplets}>No water logged in the last 30 days yet.</EmptyState>
        ) : (
          <Card className="gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl leading-none font-extrabold tabular-nums">{formatWater(waterDays.reduce((total, row) => total + Number(row.amount_ml), 0), preferences.unit)}</p>
                <p className="mt-1.5 text-xs font-medium text-muted-foreground">Water logged across {waterDays.length} {waterDays.length === 1 ? "day" : "days"}</p>
              </div>
              <TableButton label="View daily water values" onClick={() => setTable("water")} />
            </div>
            <Bars series={waterSeries} barClass="bg-water" />
            <ChartAxis start={chartStart} />
          </Card>
        )}
      </Section>

      <Section index={2} aria-labelledby="calendar-title">
        <h2 id="calendar-title" className="px-1 text-lg font-extrabold tracking-tight">Calendar</h2>
        <Card className="items-center gap-4 p-5">
          <Calendar
            className="bg-transparent p-0 [--cell-radius:9999px]"
            classNames={{
              root: "w-full",
              day_button: "rounded-full",
              today: "rounded-full bg-muted",
            }}
            mode="single"
            required
            selected={selected}
            onSelect={day => { setSelected(day); router.replace(`/history?date=${localDateISO(day)}`, { scroll: false }); }}
            month={month}
            onMonthChange={setMonth}
            disabled={{ after: today }}
            modifiers={{ logged: loggedDates }}
            modifiersClassNames={{
              logged:
                "relative after:absolute after:bottom-0.5 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-foreground/50 after:content-['']",
            }}
          />
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="size-1 rounded-full bg-foreground/50" aria-hidden="true" />
            Food or water logged
          </p>
          {selectedIso && (
            <motion.div
              key={selectedIso}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="w-full space-y-3 border-t border-black/[0.05] pt-4"
            >
              <p className="text-base font-bold">{selected.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</p>
              {summary.isLoading ? (
                <div role="status"><span className="sr-only">Loading this day…</span><Skeleton className="h-16" /></div>
              ) : summary.isError ? (
                <p className="text-xs text-muted-foreground">History is unavailable. Open the diary to check saved entries.</p>
              ) : daySummary ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Calories">{Math.round(Number(daySummary.calories))}</Stat>
                    <Stat label={daySummary.meal_count === 1 ? "Food" : "Foods"}>{daySummary.meal_count}</Stat>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Stat label="Protein" className="bg-protein/10">{Math.round(Number(daySummary.protein_g))}<span className="text-xs font-semibold text-muted-foreground"> g</span></Stat>
                    <Stat label="Carbs" className="bg-carbs/10">{Math.round(Number(daySummary.carbs_g))}<span className="text-xs font-semibold text-muted-foreground"> g</span></Stat>
                    <Stat label="Fat" className="bg-fat/10">{Math.round(Number(daySummary.fat_g))}<span className="text-xs font-semibold text-muted-foreground"> g</span></Stat>
                    <Stat label="Fiber" className="bg-fiber/10">{Number(Number(daySummary.fiber_g ?? 0).toFixed(1))}<span className="text-xs font-semibold text-muted-foreground"> g</span></Stat>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl bg-muted/70 px-3 py-3 text-center text-xs font-medium text-muted-foreground">
                  No food logged {formatDate(`${selectedIso}T00:00:00`)}
                </p>
              )}
              <p
                role={water.isError ? "alert" : "status"}
                className={`flex items-center gap-2 rounded-2xl bg-water/10 px-3 py-2.5 text-sm font-semibold ${water.isError ? "text-destructive" : ""}`}
              >
                <Droplets className="size-4 shrink-0 text-water" aria-hidden="true" />
                <span className="font-medium text-muted-foreground">Water</span>
                <span className="ml-auto tabular-nums">{water.isPending ? "Loading…" : water.isError ? "Could not load this day’s water." : formatWater(Number(waterByDay[selectedIso]?.amount_ml ?? 0), preferences.unit)}</span>
              </p>
              {incomplete && <p className="rounded-2xl bg-muted/70 px-3 py-2.5 text-xs text-muted-foreground">{incomplete}</p>}
              <Button asChild size="lg" className="w-full">
                <Link href={`/?date=${selectedIso}`} aria-label="Open this day’s food and water diary">
                  Open diary
                  <ArrowRight className="size-5" />
                </Link>
              </Button>
            </motion.div>
          )}
        </Card>
      </Section>

      <Section index={3} aria-labelledby="achievements-title">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 id="achievements-title" className="text-lg font-extrabold tracking-tight">Achievements</h2>
          <p className="text-xs font-semibold text-muted-foreground tabular-nums">{earned.filter((a) => a.earned).length} / {earned.length}</p>
        </div>
        {upcoming && <p className="px-1 text-sm text-muted-foreground">Next up: <span className="font-semibold text-foreground">{upcoming.title}</span>{upcoming.progress ? ` · ${upcoming.progress.current} / ${upcoming.progress.target}` : ""}</p>}
        <ul className="no-scrollbar -mx-4 -my-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 py-3">
          {earned.map((a, i) => (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: 0.3 + i * 0.05 }}
              className="w-36 shrink-0 snap-start"
            >
              <Card className="h-full items-center gap-2.5 px-3 py-4 text-center">
                <ProgressRing
                  size={60}
                  stroke={5}
                  value={a.earned ? 1 : a.progress ? a.progress.current / a.progress.target : 0}
                  className={a.earned ? "text-carbs" : "text-foreground/45"}
                >
                  {a.earned ? <Award className="size-6 text-carbs" aria-hidden="true" /> : <Lock className="size-5 text-muted-foreground/60" aria-hidden="true" />}
                </ProgressRing>
                <div>
                  <p className="text-sm font-bold">{a.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{a.description}</p>
                </div>
                <p className={`mt-auto inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold tabular-nums ${a.earned ? "bg-carbs/15 text-foreground" : "bg-muted text-muted-foreground"}`}>
                  {a.earned ? "Earned" : a.progress ? `${a.progress.current} / ${a.progress.target}` : "Locked"}
                </p>
              </Card>
            </motion.li>
          ))}
        </ul>
      </Section>

      <Section index={4} aria-labelledby="body-title">
        <h2 id="body-title" className="px-1 text-lg font-extrabold tracking-tight">Body</h2>
        <Link href="/weight" className="press block rounded-3xl">
          <Card className="gap-3 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">
                <Scale className="size-5" />
              </span>
              <div className="flex-1">
                <p className="text-2xl leading-none font-extrabold tabular-nums">
                  {latestWeight
                    ? <>{Number(latestWeight.trend_weight_kg ?? latestWeight.weight_kg).toFixed(1)}<span className="text-sm font-semibold text-muted-foreground"> kg</span></>
                    : "—"}
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">Trend weight</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </div>
            <TrendChart data={weighIns.data ?? []} />
          </Card>
        </Link>
        <Link href="/measurements" className="press block rounded-3xl">
          <Card className="gap-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">
                <Ruler className="size-5" />
              </span>
              <p className="flex-1 text-base font-bold">Measurements</p>
              <ChevronRight className="size-5 text-muted-foreground" />
            </div>
            {measurementGroups.size === 0 ? (
              <p className="text-xs text-muted-foreground">No measurements yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[...measurementGroups.entries()].map(([type, rows]) => {
                  const delta = rows.length > 1 ? rows[0].value_cm - rows[1].value_cm : null;
                  return (
                    <Stat key={type} label={type} className="[&>p:last-child]:capitalize">
                      {rows[0].value_cm.toFixed(1)}
                      {delta !== null && delta !== 0 && (
                        <span className="ml-1.5 text-xs font-semibold text-muted-foreground">
                          {delta > 0 ? "+" : ""}
                          {delta.toFixed(1)}
                        </span>
                      )}
                    </Stat>
                  );
                })}
              </div>
            )}
          </Card>
        </Link>
      </Section>

      <Sheet
        open={table === "food"}
        onOpenChange={(open) => { if (!open) setTable(null); }}
        title="Daily nutrition"
        description="Logged days in the last 30. Known values only."
      >
        <div className="-mx-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Daily nutrition table">
          <table className="w-full text-left text-xs tabular-nums">
            <caption className="sr-only">Food totals for logged days in the last 30 days</caption>
            <thead>
              <tr>{["Date", "Foods", "Calories", "Protein g", "Carbs g", "Fat g", "Fiber g", "Recorded target"].map(label => <th key={label} scope="col" className="p-2 font-semibold whitespace-nowrap text-muted-foreground">{label}</th>)}</tr>
            </thead>
            <tbody>
              {loggedSeries.map(row => (
                <tr key={row.day} className="border-t border-black/[0.05]">
                  <th scope="row" className="p-2 font-semibold whitespace-nowrap">
                    <Link className="inline-flex items-center gap-0.5" href={`/?date=${row.day}`}>{row.day}<ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" /></Link>
                  </th>
                  {[row.mealCount, row.calories, row.protein, row.carbs, row.fat, row.fiber].map((value, index) => <td key={index} className="p-2">{Number(value.toFixed(1))}</td>)}
                  <td className="p-2 whitespace-nowrap">{row.goal === null ? "Not recorded" : Math.round(row.goal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sheet>

      <Sheet
        open={table === "water"}
        onOpenChange={(open) => { if (!open) setTable(null); }}
        title="Daily water"
        description="Logged amounts only. A day without entries doesn’t mean no water."
      >
        <div className="-mx-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Daily water table">
          <table className="w-full text-left text-sm tabular-nums">
            <caption className="sr-only">Water totals for logged days in the last 30 days</caption>
            <thead>
              <tr>{["Date", "Water", "Entries", "Recorded target"].map(label => <th key={label} scope="col" className="p-2 text-xs font-semibold whitespace-nowrap text-muted-foreground">{label}</th>)}</tr>
            </thead>
            <tbody>
              {waterDays.map(row => {
                const target = targets.forDay(row.day)?.water;
                return (
                  <tr key={row.day} className="border-t border-black/[0.05]">
                    <th scope="row" className="p-2 font-semibold whitespace-nowrap">
                      <Link className="inline-flex items-center gap-0.5" href={`/water?date=${row.day}`}>{row.day}<ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" /></Link>
                    </th>
                    <td className="p-2 whitespace-nowrap">{formatWater(Number(row.amount_ml), preferences.unit)}</td>
                    <td className="p-2">{row.entry_count}</td>
                    <td className="p-2 whitespace-nowrap">{target == null ? "Not recorded" : formatWater(target, preferences.unit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Sheet>
    </div>
  );
}
