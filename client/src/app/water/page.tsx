"use client";

import { useState } from "react";
import { GlassWater } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProgressRing from "@/components/ProgressRing";
import BackButton from "@/components/BackButton";
import { useAddWater, useTodayWater, waterTotal } from "@/hooks/useWaterLogs";
import { formatTime } from "@/lib/utils";

const QUICK = [250, 500, 750];
const DAILY_GOAL_ML = 2000;

export default function WaterPage() {
  const [custom, setCustom] = useState("");
  const water = useTodayWater();
  const add = useAddWater();

  const total = waterTotal(water.data);

  return (
    <div className="space-y-5">
      <div className="relative flex items-center justify-center pt-1">
        <div className="absolute left-0"><BackButton /></div>
        <h1 className="text-xl font-extrabold tracking-tight">Water</h1>
      </div>

      <Card className="flex-row items-center justify-between p-6">
        <div>
          <p className="text-5xl font-extrabold tabular-nums">
            {total}
            <span className="ml-1 text-lg font-semibold text-muted-foreground">ml</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">of {DAILY_GOAL_ML} ml today</p>
        </div>
        <ProgressRing value={total / DAILY_GOAL_ML} size={96} stroke={9} className="text-water">
          <span className="flex size-12 items-center justify-center rounded-full bg-current/10 text-water">
            <GlassWater className="size-5" />
          </span>
        </ProgressRing>
      </Card>

      <div className="flex gap-2">
        {QUICK.map((ml) => (
          <Button
            key={ml}
            variant="secondary"
            className="h-12 flex-1 rounded-full bg-card shadow-soft"
            disabled={add.isPending}
            onClick={() => add.mutate(ml)}
          >
            +{ml} ml
          </Button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom) add.mutate(Number(custom), { onSuccess: () => setCustom("") });
        }}
      >
        <Input
          className="h-12 rounded-full bg-card px-5 shadow-soft"
          type="number"
          placeholder="Custom amount (ml)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button className="h-12 rounded-full px-6" disabled={add.isPending || !custom}>
          Log
        </Button>
      </form>
      {add.isError && <p className="text-sm text-destructive">{String(add.error)}</p>}

      <section className="space-y-3">
        {(water.data ?? []).map((w) => (
          <Card key={w.id} className="flex-row items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-current/10 text-water">
                <GlassWater className="size-4" />
              </span>
              <span className="text-sm font-semibold tabular-nums">{Number(w.amount_ml)} ml</span>
            </div>
            <span className="text-xs text-muted-foreground">{formatTime(w.logged_at)}</span>
          </Card>
        ))}
      </section>
    </div>
  );
}
