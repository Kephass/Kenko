"use client";

import { completenessMessage } from "@/lib/nutritionCompleteness";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { diaryDate } from "@/lib/tracking";
import { ChevronRight, Ruler, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import TrendChart from "@/components/TrendChart";
import EmptyState from "@/components/EmptyState";
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

const W = 320;
const H = 110;

function CalorieBars({ series }: { series: { calories: number; goal: number | null }[] }) {
  const max = Math.max(1, ...series.flatMap(s => [s.calories, s.goal ?? 0])) * 1.1;
  const barW = W / series.length - 2;
  return (
    <svg aria-hidden="true" viewBox={`0 -4 ${W} ${H + 8}`} className="w-full">
      {series.map((s, i) => {
        const h = (s.calories / max) * H;
        return (
          <rect
            key={i}
            x={(W / series.length) * i + 1}
            y={H - h}
            width={barW}
            height={Math.max(h, 1)}
            rx="1.5"
            className={s.calories > 0 ? "fill-foreground/75" : "fill-foreground/10"}
          />
        );
      })}
      {series.map((s, i) => s.goal === null ? null : <line key={i} x1={W / series.length * i} x2={W / series.length * (i + 1)} y1={H - s.goal / max * H} y2={H - s.goal / max * H} strokeDasharray="3 2" strokeWidth="1.5" className="stroke-muted-foreground/60" />)}
    </svg>
  );
}

function MacroBars({ series }: { series: { protein: number; carbs: number; fat: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.protein + s.carbs + s.fat)) * 1.1;
  const barW = W / series.length - 2;
  return (
    <svg aria-hidden="true" viewBox={`0 -4 ${W} ${H + 8}`} className="w-full">
      {series.map((s, i) => {
        const x = (W / series.length) * i + 1;
        let y = H;
        const segs = [
          { v: s.protein, cls: "fill-protein" },
          { v: s.carbs, cls: "fill-carbs" },
          { v: s.fat, cls: "fill-fat" },
        ];
        return (
          <g key={i}>
            {segs.map((seg, j) => {
              const h = (seg.v / max) * H;
              y -= h;
              return <rect key={j} x={x} y={y} width={barW} height={h} className={seg.cls} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

export default function HistoryPage() {
  return <Suspense fallback={<p role="status">Loading history…</p>}><DatedHistory /></Suspense>;
}
function DatedHistory() {
  const params = useSearchParams();
  const day = diaryDate(params.get("date"), localDateISO());
  return <History key={day} initialDay={day} />;
}
function History({ initialDay }: { initialDay: string }) {
  const router = useRouter();
  const today = new Date();
  const todayIso = localDateISO(today);
  const [month, setMonth] = useState<Date>(() => new Date(`${initialDay}T00:00:00`));
  const [selected, setSelected] = useState<Date>(() => new Date(`${initialDay}T00:00:00`));
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

  const streak = useLogStreak();
  const waterMlByDay = Object.fromEntries((water.data ?? []).map((r) => [r.day, Number(r.amount_ml)]));
  const week = weeklyInsights(series, waterMlByDay, todayIso);
  const earned = achievements(streak.data ?? 0, series, targets.current.fiber);
  const upcoming = nextAchievement(earned);

  const latestWeight = weighIns.data?.[0];

  const measurementGroups = new Map<string, { value_cm: number; logged_at: string }[]>();
  for (const m of measurements.data ?? []) {
    const list = measurementGroups.get(m.measurement_type) ?? [];
    list.push({ value_cm: Number(m.value_cm), logged_at: m.logged_at });
    measurementGroups.set(m.measurement_type, list);
  }

  return (
    <div className="space-y-5">
      <h1 className="pt-1 text-xl font-extrabold tracking-tight">Progress</h1>

      {targets.isError && <p role="alert" className="text-xs text-destructive">Target history could not be loaded. Chart target marks may be incomplete.</p>}
      {summary.isLoading && <p role="status">Loading food history…</p>}
      {summary.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(summary.error)}</p>}
      <Card className="items-center gap-2 p-4">
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
        <p className="text-xs text-muted-foreground">Dots mark days with food or water entries.</p>
        {selectedIso && (
          <div className="w-full border-t border-black/[0.05] px-2 pt-3 text-sm">
            {summary.isLoading ? <p role="status">Loading this day…</p> : summary.isError ? <p className="text-xs text-muted-foreground">History is unavailable. Open the diary to check saved entries.</p> : daySummary ? (
              <div className="flex items-baseline justify-between">
                <span className="font-semibold tabular-nums">
                  {Math.round(Number(daySummary.calories))} cal
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  P {Math.round(Number(daySummary.protein_g))}g · C {Math.round(Number(daySummary.carbs_g))}g · F{" "}
                  {Math.round(Number(daySummary.fat_g))}g · {daySummary.meal_count}{" "}
                  {daySummary.meal_count === 1 ? "food" : "foods"}
                </span>
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                No food logged {formatDate(`${selectedIso}T00:00:00`)}
              </p>
            )}
            {daySummary && <p className="mt-2 text-xs text-muted-foreground">Fiber: {Number(Number(daySummary.fiber_g ?? 0).toFixed(1))} g (known amounts)</p>}
            <p className="mt-2 text-sm" role={water.isError ? "alert" : "status"}>Water: {water.isPending ? "Loading…" : water.isError ? "Could not load this day’s water." : formatWater(Number(waterByDay[selectedIso]?.amount_ml ?? 0), preferences.unit)}</p>
            {completenessMessage(daySummary) && <p className="mt-2 rounded-lg bg-muted p-2 text-xs text-muted-foreground">{completenessMessage(daySummary)}</p>}
            <Link href={`/?date=${selectedIso}`} className="mt-3 block text-center font-semibold underline">Open this day’s food and water diary</Link>
          </div>
        )}
      </Card>

      <section className="space-y-3" aria-labelledby="this-week-title">
        <h2 id="this-week-title" className="text-lg font-extrabold">This week</h2>
        <Card className="gap-3 p-4">
          {week.loggedDays === 0 ? (
            <p className="text-sm text-muted-foreground">No food logged in the last 7 days yet. Log a meal to start your weekly report.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Days logged</p>
                  <p className="text-2xl font-extrabold tabular-nums">{week.loggedDays}<span className="text-sm font-semibold text-muted-foreground"> / 7</span></p>
                </div>
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Avg calories</p>
                  <p className="text-2xl font-extrabold tabular-nums">{week.avgCalories}</p>
                  {week.vsTarget != null && <p className="text-xs text-muted-foreground">{week.vsTarget <= 0 ? `${Math.abs(week.vsTarget)} under target` : `${week.vsTarget} over target`}</p>}
                </div>
                {week.macroSplit && (
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Macro split</p>
                    <p className="text-sm font-semibold tabular-nums">P {week.macroSplit.protein}% · C {week.macroSplit.carbs}% · F {week.macroSplit.fat}%</p>
                  </div>
                )}
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Water</p>
                  <p className="text-2xl font-extrabold tabular-nums">{(week.totalWaterMl / 1000).toFixed(1)}<span className="text-sm font-semibold text-muted-foreground"> L</span></p>
                </div>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {week.callouts.map((c, i) => <li key={i}>• {c}</li>)}
              </ul>
            </>
          )}
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="achievements-title">
        <h2 id="achievements-title" className="text-lg font-extrabold">Achievements</h2>
        {upcoming && <p className="text-sm text-muted-foreground">Next up: <span className="font-semibold text-foreground">{upcoming.title}</span>{upcoming.progress ? ` — ${upcoming.progress.current} / ${upcoming.progress.target}` : ""}</p>}
        <div className="grid grid-cols-2 gap-3">
          {earned.map((a) => (
            <Card key={a.id} className={`gap-1 p-3 ${a.earned ? "ring-1 ring-foreground/15" : "opacity-60"}`}>
              <div className="flex items-center justify-between">
                <span className="text-lg">{a.earned ? "🏅" : "🔒"}</span>
                {a.progress && !a.earned && <span className="text-xs tabular-nums text-muted-foreground">{a.progress.current}/{a.progress.target}</span>}
              </div>
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Last 30 days</h2>
        {summary.isLoading || summary.isError ? null : hasMeals ? (
          <>
            <Card className="gap-2 p-4">
              <p className="text-xs text-muted-foreground">
                Calories · dashed marks show recorded daily targets; gaps have no saved target
              </p>
              <CalorieBars series={series} />
            </Card>
            <Card className="gap-2 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Macros (g) · known values only</p>
                <div className="flex gap-3">
                  {MACROS.map(({ key, label, colorClass }) => (
                    <span key={key} className={`flex items-center gap-1 text-xs ${colorClass}`}>
                      <span className="size-2 rounded-full bg-current" />
                      <span className="text-muted-foreground">{label}</span>
                    </span>
                  ))}
                </div>
              </div>
              <MacroBars series={series} />
            </Card>
            <details className="rounded-xl bg-card p-4">
              <summary className="cursor-pointer text-sm font-semibold">View daily nutrition values</summary>
              <p className="my-2 text-xs text-muted-foreground">Days with food entries. Nutrient amounts include known values only; open a day to review missing information.</p>
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Daily nutrition table">
                <table className="w-full text-left text-xs tabular-nums"><caption className="sr-only">Food totals for logged days in the last 30 days</caption><thead><tr>{["Date", "Foods", "Calories", "Protein g", "Carbs g", "Fat g", "Fiber g", "Recorded target"].map(label => <th key={label} scope="col" className="whitespace-nowrap p-2">{label}</th>)}</tr></thead><tbody>{series.filter(row => row.mealCount > 0).map(row => <tr key={row.day} className="border-t"><th scope="row" className="whitespace-nowrap p-2 font-medium"><Link className="underline" href={`/?date=${row.day}`}>{row.day}</Link></th>{[row.mealCount, row.calories, row.protein, row.carbs, row.fat, row.fiber].map((value,index) => <td key={index} className="p-2">{Number(value.toFixed(1))}</td>)}<td className="p-2">{row.goal === null ? "Not recorded" : Math.round(row.goal)}</td></tr>)}</tbody></table>
              </div>
            </details>
          </>
        ) : (
          <EmptyState>No confirmed meals in the last 30 days yet.</EmptyState>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="water-history-title">
        <h2 id="water-history-title" className="text-lg font-extrabold">Water · last 30 days</h2>
        {water.isPending ? <p role="status">Loading water history…</p> : water.isError ? <p role="alert" className="text-sm text-destructive">Water history could not be loaded.</p> : waterDays.length === 0 ? <EmptyState>No water logged in the last 30 days yet.</EmptyState> : <Card className="gap-3 p-4">
          <p className="font-semibold">{formatWater(waterDays.reduce((total, row) => total + Number(row.amount_ml), 0), preferences.unit)} logged across {waterDays.length} {waterDays.length === 1 ? "day" : "days"}</p>
          <p className="text-xs text-muted-foreground">Logged amounts only. A day without entries does not mean you drank no water. Targets reflect saved history.</p>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Daily water table">
            <table className="w-full text-left text-sm tabular-nums">
              <caption className="sr-only">Water totals for logged days in the last 30 days</caption>
              <thead><tr>{["Date", "Water", "Entries", "Recorded target"].map(label => <th key={label} scope="col" className="whitespace-nowrap p-2">{label}</th>)}</tr></thead>
              <tbody>{waterDays.map(row => {
                const target = targets.forDay(row.day)?.water;
                return <tr key={row.day} className="border-t">
                  <th scope="row" className="whitespace-nowrap p-2 font-medium"><Link className="underline" href={`/water?date=${row.day}`}>{row.day}</Link></th>
                  <td className="whitespace-nowrap p-2">{formatWater(Number(row.amount_ml), preferences.unit)}</td>
                  <td className="p-2">{row.entry_count}</td>
                  <td className="whitespace-nowrap p-2">{target == null ? "Not recorded" : formatWater(target, preferences.unit)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </Card>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Body</h2>
        <Link href="/weight" className="block">
          <Card className="gap-2 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <Scale className="size-4.5" />
                </span>
                <div>
                  <p className="font-extrabold tabular-nums">
                    {latestWeight
                      ? `${Number(latestWeight.trend_weight_kg ?? latestWeight.weight_kg).toFixed(1)} kg`
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Trend weight</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
            <TrendChart data={weighIns.data ?? []} />
          </Card>
        </Link>
        <Link href="/measurements" className="block">
          <Card className="gap-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <Ruler className="size-4.5" />
                </span>
                <p className="text-sm font-semibold">Measurements</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
            {measurementGroups.size === 0 ? (
              <p className="text-xs text-muted-foreground">No measurements yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[...measurementGroups.entries()].map(([type, rows]) => {
                  const delta = rows.length > 1 ? rows[0].value_cm - rows[1].value_cm : null;
                  return (
                    <div key={type} className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground capitalize">{type}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {rows[0].value_cm.toFixed(1)}
                        {delta !== null && delta !== 0 && (
                          <span className="ml-1 text-xs font-medium text-muted-foreground">
                            {delta > 0 ? "+" : ""}
                            {delta.toFixed(1)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Link>
      </section>
    </div>
  );
}
