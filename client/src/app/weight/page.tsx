"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AnimatedNumber from "@/components/AnimatedNumber";
import PageHeader from "@/components/PageHeader";
import TrendChart from "@/components/TrendChart";
import { toast } from "@/components/Toaster";
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
  const history = (weighIns.data ?? []).slice(0, 14);
  const dayLabel = day === today ? "Today" : new Date(`${day}T12:00`).toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <div className="space-y-5">
      <PageHeader title="Weight" back />

      {weighIns.isLoading ? (
        <div role="status"><span className="sr-only">Loading weight…</span><Skeleton className="h-64 rounded-3xl" /></div>
      ) : (
        <Card className="gap-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Trend weight</p>
              <p className="mt-1.5 text-6xl leading-none font-extrabold tracking-tight tabular-nums">
                {latest ? <AnimatedNumber value={Number(latest.trend_weight_kg ?? latest.weight_kg)} decimals={1} /> : "—"}
                <span className="ml-1.5 text-lg font-semibold tracking-normal text-muted-foreground">kg</span>
              </p>
              {latest && <p className="mt-2 text-sm text-muted-foreground tabular-nums">Last weigh-in {Number(latest.weight_kg).toFixed(1)} kg</p>}
            </div>
            {bodyFat.data != null && (
              <div className="rounded-2xl bg-muted/70 px-3.5 py-2.5 text-right">
                <p className="text-lg leading-tight font-extrabold tabular-nums">{Number(bodyFat.data).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">body fat</p>
              </div>
            )}
          </div>
          <TrendChart data={weighIns.data ?? []} />
        </Card>
      )}

      <form
        className="flex items-center gap-2 rounded-full bg-card p-1.5 pl-5 shadow-soft ring-1 ring-black/[0.04]"
        onSubmit={(e) => {
          e.preventDefault();
          if (weight)
            add.mutate(
              { weight_kg: Number(weight), day },
              {
                onSuccess: () => {
                  toast(`${Number(weight).toFixed(1)} kg logged`);
                  setWeight("");
                  setDay(today);
                },
              },
            );
        }}
      >
        <input
          aria-label="Weight (kg)"
          className="h-10 min-w-0 flex-1 bg-transparent text-base font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground/70"
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="Weight (kg)"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <label className="press relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-muted px-3 text-sm font-medium">
          <CalendarDays className="size-4 text-muted-foreground" />
          {dayLabel}
          <input
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            type="date"
            max={today}
            value={day}
            onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* picker needs a user gesture */ } }}
            onChange={(e) => setDay(e.target.value || today)}
            aria-label="Weigh-in date"
          />
        </label>
        <Button disabled={add.isPending || !weight}>Log</Button>
      </form>
      {add.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(add.error)}</p>}
      {weighIns.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(weighIns.error)}</p>}

      <section className="space-y-3" aria-label="Weigh-in history">
        <h2 className="px-1 text-lg font-extrabold tracking-tight">History</h2>
        {weighIns.isLoading && <Skeleton className="h-40 rounded-3xl" />}
        {history.length > 0 && (
          <Card className="relative gap-0 divide-y divide-black/[0.05] py-0">
            <AnimatePresence initial={false} mode="popLayout">
              {history.map((w) => (
                <motion.div
                  key={w.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", damping: 30, stiffness: 380 }}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <span className="text-sm text-muted-foreground">{formatDate(w.logged_at)}</span>
                  <span className="flex items-baseline gap-3 tabular-nums">
                    <span className="text-xs text-muted-foreground">trend {w.trend_weight_kg ? Number(w.trend_weight_kg).toFixed(1) : "—"}</span>
                    <span className="text-base font-bold">{Number(w.weight_kg).toFixed(1)} <span className="text-xs font-medium text-muted-foreground">kg</span></span>
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </Card>
        )}
        {weighIns.data?.length === 0 && (
          <Card className="items-center gap-2 p-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-foreground/5"><Scale className="size-5" /></span>
            <p className="text-sm text-muted-foreground">No weigh-ins yet. Log your first above.</p>
          </Card>
        )}
      </section>
    </div>
  );
}
