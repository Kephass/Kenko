"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Ruler, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import TrendChart from "@/components/TrendChart";
import EmptyState from "@/components/EmptyState";
import { MACROS } from "@/lib/macros";
import { deriveDailyGoals } from "@/lib/goals";
import { formatDate, localDateISO } from "@/lib/utils";
import { useDailySummary, summaryByDay } from "@/hooks/useDailySummary";
import { useWeeklyBalance } from "@/hooks/useWeeklyBalance";
import { useWeighIns } from "@/hooks/useWeighIns";
import { useMeasurements } from "@/hooks/useMeasurements";

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

const W = 320;
const H = 110;

function CalorieBars({ series, goal }: { series: { calories: number }[]; goal: number }) {
  const max = Math.max(goal, ...series.map((s) => s.calories)) * 1.1;
  const barW = W / series.length - 2;
  const goalY = H - (goal / max) * H;
  return (
    <svg viewBox={`0 -4 ${W} ${H + 8}`} className="w-full">
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
      <line x1="0" y1={goalY} x2={W} y2={goalY} strokeDasharray="4 4" strokeWidth="1.5" className="stroke-muted-foreground/60" />
    </svg>
  );
}

function MacroBars({ series }: { series: { protein: number; carbs: number; fat: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.protein + s.carbs + s.fat)) * 1.1;
  const barW = W / series.length - 2;
  return (
    <svg viewBox={`0 -4 ${W} ${H + 8}`} className="w-full">
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
  const today = new Date();
  const todayIso = localDateISO(today);
  const [month, setMonth] = useState<Date>(today);
  const [selected, setSelected] = useState<Date | undefined>(today);

  const monthStart = localDateISO(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = localDateISO(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const monthSummary = useDailySummary(monthStart, monthEnd);

  const chartStart = localDateISO(addDays(today, -29));
  const last30 = useDailySummary(chartStart, todayIso);

  const balance = useWeeklyBalance();
  const weighIns = useWeighIns();
  const measurements = useMeasurements();

  const goals = deriveDailyGoals(balance.data?.calories_out);
  const byDay = summaryByDay(monthSummary.data);
  const selectedIso = selected ? localDateISO(selected) : undefined;
  const daySummary = selectedIso ? byDay[selectedIso] : undefined;
  const loggedDates = (monthSummary.data ?? []).map((r) => new Date(`${r.day}T00:00:00`));

  const by30 = summaryByDay(last30.data);
  const series = Array.from({ length: 30 }, (_, i) => {
    const row = by30[localDateISO(addDays(today, i - 29))];
    return {
      calories: Number(row?.calories ?? 0),
      protein: Number(row?.protein_g ?? 0),
      carbs: Number(row?.carbs_g ?? 0),
      fat: Number(row?.fat_g ?? 0),
    };
  });
  const hasMeals = series.some((s) => s.calories > 0);

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

      <Card className="items-center gap-2 p-4">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={setSelected}
          month={month}
          onMonthChange={setMonth}
          disabled={{ after: today }}
          modifiers={{ logged: loggedDates }}
          modifiersClassNames={{
            logged:
              "relative after:absolute after:bottom-0.5 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-foreground/50 after:content-['']",
          }}
        />
        {selectedIso && (
          <div className="w-full border-t border-black/[0.05] px-2 pt-3 text-sm">
            {daySummary ? (
              <div className="flex items-baseline justify-between">
                <span className="font-semibold tabular-nums">
                  {Math.round(Number(daySummary.calories))} cal
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  P {Math.round(Number(daySummary.protein_g))}g · C {Math.round(Number(daySummary.carbs_g))}g · F{" "}
                  {Math.round(Number(daySummary.fat_g))}g · {daySummary.meal_count}{" "}
                  {daySummary.meal_count === 1 ? "meal" : "meals"}
                </span>
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Nothing logged {formatDate(`${selectedIso}T00:00:00`)}
              </p>
            )}
          </div>
        )}
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Last 30 days</h2>
        {hasMeals ? (
          <>
            <Card className="gap-2 p-4">
              <p className="text-xs text-muted-foreground">
                Calories · dashed line is your {Math.round(goals.calorieTarget)} cal target
              </p>
              <CalorieBars series={series} goal={goals.calorieTarget} />
            </Card>
            <Card className="gap-2 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Macros (g)</p>
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
          </>
        ) : (
          <EmptyState>No confirmed meals in the last 30 days yet.</EmptyState>
        )}
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
