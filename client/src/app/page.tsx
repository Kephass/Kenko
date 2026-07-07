"use client";

import { useWeeklyBalance } from "@/hooks/useWeeklyBalance";
import { useWeighIns } from "@/hooks/useWeighIns";
import { useTodayMealLogs } from "@/hooks/useMealLogs";
import { useTodayWater } from "@/hooks/useWaterLogs";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4 dark:border-neutral-700">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const balance = useWeeklyBalance();
  const weighIns = useWeighIns();
  const meals = useTodayMealLogs();
  const water = useTodayWater();

  const latest = weighIns.data?.[0];
  const confirmed = (meals.data ?? []).filter((m) => m.confirmed);
  const macros = confirmed.reduce(
    (acc, m) => ({
      calories: acc.calories + Number(m.calories ?? 0),
      protein: acc.protein + Number(m.protein_g ?? 0),
      carbs: acc.carbs + Number(m.carbs_g ?? 0),
      fat: acc.fat + Number(m.fat_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const waterMl = (water.data ?? []).reduce((sum, w) => sum + Number(w.amount_ml), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Today</h1>

      <Card title="Weight trend">
        {latest ? (
          <p className="text-2xl tabular-nums">
            {Number(latest.trend_weight_kg ?? latest.weight_kg).toFixed(1)} kg
            <span className="ml-2 text-sm text-neutral-500">
              raw {Number(latest.weight_kg).toFixed(1)} kg
            </span>
          </p>
        ) : (
          <p className="text-sm text-neutral-500">No weigh-ins yet - log one on the Weight tab.</p>
        )}
      </Card>

      <Card title="7-day energy balance (rolling)">
        {balance.data ? (
          <div className="space-y-1 text-sm tabular-nums">
            <p className="text-2xl">
              {Number(balance.data.balance) > 0 ? "+" : ""}
              {Math.round(Number(balance.data.balance))} kcal
            </p>
            <p className="text-neutral-500">
              in {Math.round(Number(balance.data.calories_in))} · out{" "}
              {Math.round(Number(balance.data.calories_out))} ({balance.data.calories_out_source})
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            {balance.isLoading ? "Loading…" : "Set up your profile in Settings first."}
          </p>
        )}
      </Card>

      <Card title="Today's macros (confirmed meals)">
        <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
          {(
            [
              ["kcal", macros.calories],
              ["protein", macros.protein],
              ["carbs", macros.carbs],
              ["fat", macros.fat],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <div className="text-lg font-medium">{Math.round(value)}</div>
              <div className="text-xs text-neutral-500">{label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Water">
        <p className="text-2xl tabular-nums">
          {waterMl} <span className="text-sm text-neutral-500">ml today</span>
        </p>
      </Card>
    </div>
  );
}
