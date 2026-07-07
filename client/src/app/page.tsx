"use client";

import Link from "next/link";
import { Flame, Ruler, GlassWater, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import ProgressRing from "@/components/ProgressRing";
import WeekStrip from "@/components/WeekStrip";
import EmptyState from "@/components/EmptyState";
import { MACROS } from "@/lib/macros";
import { deriveDailyGoals } from "@/lib/goals";
import { formatTime } from "@/lib/utils";
import { useWeeklyBalance } from "@/hooks/useWeeklyBalance";
import { useLogStreak, useTodayMealLogs } from "@/hooks/useMealLogs";
import { useTodayWater, waterTotal } from "@/hooks/useWaterLogs";
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

export default function Dashboard() {
  const balance = useWeeklyBalance();
  const meals = useTodayMealLogs();
  const water = useTodayWater();
  const latestMeasurement = useLatestMeasurement();
  const streak = useLogStreak();

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

      <WeekStrip />

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
              <p className="text-xs text-muted-foreground">Water today</p>
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
        <h2 className="text-lg font-extrabold">Recently eaten</h2>
        {confirmed.length === 0 && (
          <EmptyState>Nothing logged today. Tap + to log your first meal.</EmptyState>
        )}
        {confirmed.map((m) => (
          <Card key={m.id} className="flex-row items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                <Flame className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold tabular-nums">{Math.round(Number(m.calories))} calories</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  P {Math.round(Number(m.protein_g ?? 0))}g · C {Math.round(Number(m.carbs_g ?? 0))}g · F{" "}
                  {Math.round(Number(m.fat_g ?? 0))}g
                </p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{formatTime(m.logged_at)}</span>
          </Card>
        ))}
      </section>
    </div>
  );
}
