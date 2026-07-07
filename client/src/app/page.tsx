"use client";

import { useState } from "react";
import Link from "next/link";
import { Flame, Ruler, GlassWater, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProgressRing from "@/components/ProgressRing";
import MacroInputs from "@/components/MacroInputs";
import WeekStrip, { weekStripDays } from "@/components/WeekStrip";
import EmptyState from "@/components/EmptyState";
import { MACROS } from "@/lib/macros";
import { deriveDailyGoals } from "@/lib/goals";
import { formatDate, formatTime, localDateISO } from "@/lib/utils";
import { useWeeklyBalance } from "@/hooks/useWeeklyBalance";
import {
  useDeleteMealLog,
  useLogStreak,
  useMealLogsForDay,
  useUpdateMealLog,
} from "@/hooks/useMealLogs";
import { useDailySummary } from "@/hooks/useDailySummary";
import { useWaterForDay, waterTotal } from "@/hooks/useWaterLogs";
import { useLatestMeasurement } from "@/hooks/useMeasurements";

function MacroCard({
  left,
  label,
  ratio,
  colorClass,
  Icon,
}: {
  left: number;
  label: string;
  ratio: number;
  colorClass: string;
  Icon: LucideIcon;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div>
        <p className="text-lg font-extrabold tabular-nums">{Math.max(0, Math.round(left))}g</p>
        <p className="text-xs text-muted-foreground">{label} left</p>
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
}: {
  meal: { id: string; calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null; logged_at: string };
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const update = useUpdateMealLog();
  const del = useDeleteMealLog();

  if (!editing) {
    return (
      <Card
        className="flex-row items-center justify-between p-4"
        onClick={() => setEditing(true)}
        role="button"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-muted">
            <Flame className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold tabular-nums">{Math.round(Number(meal.calories))} calories</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              P {Math.round(Number(meal.protein_g ?? 0))}g · C {Math.round(Number(meal.carbs_g ?? 0))}g · F{" "}
              {Math.round(Number(meal.fat_g ?? 0))}g
            </p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{formatTime(meal.logged_at)}</span>
      </Card>
    );
  }

  const current = values ?? {
    calories: String(Math.round(Number(meal.calories))),
    protein: String(Math.round(Number(meal.protein_g ?? 0))),
    carbs: String(Math.round(Number(meal.carbs_g ?? 0))),
    fat: String(Math.round(Number(meal.fat_g ?? 0))),
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Input
          className="h-10 w-24 border-0 bg-muted/60 text-lg font-extrabold tabular-nums shadow-none"
          type="number"
          inputMode="numeric"
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
          onClick={() =>
            update.mutate(
              {
                id: meal.id,
                edits: {
                  calories: Number(current.calories) || 0,
                  protein_g: Number(current.protein) || 0,
                  carbs_g: Number(current.carbs) || 0,
                  fat_g: Number(current.fat) || 0,
                },
              },
              { onSuccess: () => setEditing(false) },
            )
          }
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
          onClick={() => del.mutate(meal.id)}
        >
          Delete
        </Button>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const today = localDateISO();
  const [selectedDay, setSelectedDay] = useState(today);
  const isToday = selectedDay === today;

  const balance = useWeeklyBalance();
  const meals = useMealLogsForDay(selectedDay);
  const water = useWaterForDay(selectedDay);
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
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const goals = deriveDailyGoals(balance.data?.calories_out);
  const caloriesLeft = Math.round(goals.calorieTarget - eaten.calories);
  const waterMl = waterTotal(water.data);
  const lastMeasurement = latestMeasurement.data;
  const ratios = Object.fromEntries(
    (week.data ?? []).map((r) => [r.day, Number(r.calories) / goals.calorieTarget]),
  );

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-extrabold tracking-tight">
          Kenko <span className="align-middle text-xs font-medium text-muted-foreground">健康</span>
        </h1>
        {streak.data !== undefined && (
          <span className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-sm font-semibold tabular-nums shadow-soft ring-1 ring-black/[0.04]">
            <Flame className="size-4 fill-carbs text-carbs" />
            {streak.data}
          </span>
        )}
      </header>

      <WeekStrip selected={selectedDay} onSelect={setSelectedDay} ratios={ratios} />

      <Card className="flex-row items-center justify-between p-6">
        <div>
          <p className="text-5xl font-extrabold tabular-nums">
            {balance.isLoading ? "…" : Math.abs(caloriesLeft)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {caloriesLeft >= 0 ? "Calories left" : "Calories over"}
          </p>
        </div>
        <ProgressRing value={eaten.calories / goals.calorieTarget} size={96} stroke={9}>
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Flame className="size-5" />
          </span>
        </ProgressRing>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {MACROS.map(({ key, label, colorClass, Icon }) => (
          <MacroCard
            key={key}
            left={goals[key] - eaten[key]}
            label={label}
            ratio={eaten[key] / goals[key]}
            colorClass={colorClass}
            Icon={Icon}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/water">
          <Card className="flex-row items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-full bg-current/10 text-water">
              <GlassWater className="size-4.5" />
            </span>
            <div>
              <p className="font-extrabold tabular-nums">{waterMl} ml</p>
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

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">
          {isToday ? "Recently eaten" : `Eaten ${formatDate(`${selectedDay}T00:00:00`)}`}
        </h2>
        {confirmed.length === 0 && (
          <EmptyState>
            {isToday ? "Nothing logged today. Tap + to log your first meal." : "Nothing logged this day."}
          </EmptyState>
        )}
        {confirmed.map((m) => (
          <MealCard key={m.id} meal={m} />
        ))}
      </section>
    </div>
  );
}
