"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/EmptyState";
import BackButton from "@/components/BackButton";
import TrendChart from "@/components/TrendChart";
import { errorMessage, formatDate, localDateISO } from "@/lib/utils";
import { useAddWeighIn, useWeighIns } from "@/hooks/useWeighIns";
import { useBodyFat } from "@/hooks/useMeasurements";

export default function WeightPage() {
  const today = localDateISO();
  const [weight, setWeight] = useState("");
  const [day, setDay] = useState(today);
  const weighIns = useWeighIns();
  const bodyFat = useBodyFat();
  const add = useAddWeighIn();

  const latest = weighIns.data?.[0];

  return (
    <div className="space-y-5">
      <div className="relative flex items-center justify-center pt-1">
        <div className="absolute left-0"><BackButton /></div>
        <h1 className="text-xl font-extrabold tracking-tight">Weight</h1>
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-5xl font-extrabold tabular-nums">
              {latest ? Number(latest.trend_weight_kg ?? latest.weight_kg).toFixed(1) : "—"}
              <span className="ml-1 text-lg font-semibold text-muted-foreground">kg</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Trend weight{latest ? ` · raw ${Number(latest.weight_kg).toFixed(1)} kg` : ""}
            </p>
          </div>
          {bodyFat.data != null && (
            <div className="rounded-2xl bg-muted/60 px-3 py-2 text-right">
              <p className="text-lg font-extrabold tabular-nums">{Number(bodyFat.data).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">body fat</p>
            </div>
          )}
        </div>
        <TrendChart data={weighIns.data ?? []} />
      </Card>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (weight)
            add.mutate(
              { weight_kg: Number(weight), day },
              {
                onSuccess: () => {
                  setWeight("");
                  setDay(today);
                },
              },
            );
        }}
      >
        <div className="flex gap-2">
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
        </div>
        <Input
          className="h-12 rounded-full bg-card px-5 shadow-soft"
          type="date"
          max={today}
          value={day}
          onChange={(e) => setDay(e.target.value)}
          aria-label="Weigh-in date"
        />
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
