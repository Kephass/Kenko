"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/EmptyState";
import { errorMessage, formatDate } from "@/lib/utils";
import { useAddWeighIn, useWeighIns } from "@/hooks/useWeighIns";

function TrendChart({ data }: { data: { logged_at: string; weight_kg: number; trend_weight_kg: number | null }[] }) {
  if (data.length < 2) return null;
  const points = [...data].reverse();
  const values = points.flatMap((p) => [Number(p.weight_kg), Number(p.trend_weight_kg ?? p.weight_kg)]);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const W = 320;
  const H = 120;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const trendPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(Number(p.trend_weight_kg ?? p.weight_kg)).toFixed(1)}`)
    .join(" ");
  const areaPath = `${trendPath} L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`-4 -6 ${W + 8} ${H + 12}`} className="w-full">
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#trend-fill)" className="text-foreground" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(Number(p.weight_kg))} r="2.5" className="fill-muted-foreground/40" />
      ))}
      <path d={trendPath} fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-foreground" />
    </svg>
  );
}

export default function WeightPage() {
  const [weight, setWeight] = useState("");
  const weighIns = useWeighIns();
  const add = useAddWeighIn();

  const latest = weighIns.data?.[0];

  return (
    <div className="space-y-5">
      <h1 className="pt-1 text-xl font-extrabold tracking-tight">Progress</h1>

      <Card className="space-y-4 p-6">
        <div>
          <p className="text-5xl font-extrabold tabular-nums">
            {latest ? Number(latest.trend_weight_kg ?? latest.weight_kg).toFixed(1) : "—"}
            <span className="ml-1 text-lg font-semibold text-muted-foreground">kg</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Trend weight{latest ? ` · raw ${Number(latest.weight_kg).toFixed(1)} kg` : ""}
          </p>
        </div>
        <TrendChart data={weighIns.data ?? []} />
      </Card>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (weight) add.mutate(Number(weight), { onSuccess: () => setWeight("") });
        }}
      >
        <Input
          className="h-12 rounded-full bg-card px-5 shadow-soft"
          type="number"
          step="0.1"
          placeholder="Weight (kg)"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <Button className="h-12 rounded-full px-6" disabled={add.isPending || !weight}>
          Log
        </Button>
      </form>
      {add.isError && <p className="text-sm text-destructive">{errorMessage(add.error)}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">History</h2>
        {(weighIns.data ?? []).slice(0, 14).map((w) => (
          <Card key={w.id} className="flex-row items-center justify-between p-4">
            <span className="text-sm text-muted-foreground">{formatDate(w.logged_at)}</span>
            <span className="text-sm tabular-nums">
              <span className="font-semibold">{Number(w.weight_kg).toFixed(1)}</span>
              <span className="ml-2 text-muted-foreground">
                trend {w.trend_weight_kg ? Number(w.trend_weight_kg).toFixed(1) : "—"}
              </span>
            </span>
          </Card>
        ))}
        {weighIns.data?.length === 0 && (
          <EmptyState>No weigh-ins yet. Log the first one above.</EmptyState>
        )}
      </section>
    </div>
  );
}
