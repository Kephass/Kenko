"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ruler } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AnimatedNumber from "@/components/AnimatedNumber";
import PageHeader from "@/components/PageHeader";
import { Chip } from "@/components/Chips";
import { toast } from "@/components/Toaster";
import { errorMessage, formatDate } from "@/lib/utils";
import {
  useAddMeasurement,
  useBodyFat,
  useMeasurements,
  type MeasurementType,
} from "@/hooks/useMeasurements";

const TYPES: MeasurementType[] = ["waist", "hip", "chest", "neck", "thigh", "arm"];

export default function MeasurementsPage() {
  const [type, setType] = useState<MeasurementType>("waist");
  const [value, setValue] = useState("");
  const measurements = useMeasurements();
  const bodyFat = useBodyFat();
  const add = useAddMeasurement();
  const rows = measurements.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title="Measurements" subtitle="Waist, neck and hip drive the body-fat estimate." back />

      {bodyFat.data != null && (
        <Card className="flex-row items-center justify-between p-6">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Estimated body fat</p>
            <p className="mt-1.5 text-5xl leading-none font-extrabold tracking-tight tabular-nums">
              <AnimatedNumber value={Number(bodyFat.data)} decimals={1} />
              <span className="ml-1 text-lg font-semibold tracking-normal text-muted-foreground">%</span>
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Navy method</span>
        </Card>
      )}

      <div role="group" aria-label="Measurement type" className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <Chip key={t} selected={type === t} className="capitalize" onClick={() => setType(t)}>
            {t}
          </Chip>
        ))}
      </div>

      <form
        className="flex items-center gap-2 rounded-full bg-card p-1.5 pl-5 shadow-soft ring-1 ring-black/[0.04]"
        onSubmit={(e) => {
          e.preventDefault();
          if (value)
            add.mutate(
              { measurement_type: type, value_cm: Number(value) },
              {
                onSuccess: (_data, input) => {
                  toast(`${input.measurement_type[0].toUpperCase()}${input.measurement_type.slice(1)} ${input.value_cm.toFixed(1)} cm logged`);
                  setValue("");
                },
              },
            );
        }}
      >
        <input
          aria-label={`${type} (cm)`}
          className="h-10 min-w-0 flex-1 bg-transparent text-base font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground/70"
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder={`${type[0].toUpperCase()}${type.slice(1)} (cm)`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button disabled={add.isPending || !value}>Log</Button>
      </form>
      {add.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(add.error)}</p>}
      {measurements.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(measurements.error)}</p>}

      <section className="space-y-3" aria-label="Measurement history">
        <h2 className="px-1 text-lg font-extrabold tracking-tight">History</h2>
        {measurements.isLoading && (
          <div role="status"><span className="sr-only">Loading measurements…</span><Skeleton className="h-40 rounded-3xl" /></div>
        )}
        {rows.length > 0 && (
          <Card className="relative gap-0 divide-y divide-black/[0.05] py-0">
            <AnimatePresence initial={false} mode="popLayout">
              {rows.map((m) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", damping: 30, stiffness: 380 }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fat/10 text-fat"><Ruler className="size-4.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold capitalize">{m.measurement_type}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(m.logged_at)}</p>
                  </div>
                  <span className="text-base font-bold tabular-nums">{Number(m.value_cm).toFixed(1)} <span className="text-xs font-medium text-muted-foreground">cm</span></span>
                </motion.div>
              ))}
            </AnimatePresence>
          </Card>
        )}
        {measurements.data?.length === 0 && (
          <Card className="items-center gap-2 p-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-fat/10 text-fat"><Ruler className="size-5" /></span>
            <p className="text-sm text-muted-foreground">No measurements yet. Pick a type and log one.</p>
          </Card>
        )}
      </section>
    </div>
  );
}
