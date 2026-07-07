"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/utils";
import {
  useAddMeasurement,
  useMeasurements,
  type MeasurementType,
} from "@/hooks/useMeasurements";

const TYPES: MeasurementType[] = ["waist", "hip", "chest", "neck", "thigh", "arm"];

export default function MeasurementsPage() {
  const [type, setType] = useState<MeasurementType>("waist");
  const [value, setValue] = useState("");
  const measurements = useMeasurements();
  const add = useAddMeasurement();

  return (
    <div className="space-y-5">
      <div className="pt-1">
        <h1 className="text-xl font-extrabold tracking-tight">Measurements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Waist, neck and hip also drive the body-fat estimate.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors ${
              type === t ? "bg-foreground text-background" : "bg-card text-muted-foreground shadow-sm"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (value)
            add.mutate(
              { measurement_type: type, value_cm: Number(value) },
              { onSuccess: () => setValue("") },
            );
        }}
      >
        <Input
          className="h-12 rounded-full bg-card px-5 shadow-sm"
          type="number"
          step="0.1"
          placeholder={`${type} (cm)`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button className="h-12 rounded-full px-6" disabled={add.isPending || !value}>
          Log
        </Button>
      </form>
      {add.isError && <p className="text-sm text-destructive">{String(add.error)}</p>}

      <section className="space-y-3">
        {(measurements.data ?? []).map((m) => (
          <Card key={m.id} className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold capitalize">{m.measurement_type}</p>
              <p className="text-xs text-muted-foreground">{formatDate(m.logged_at)}</p>
            </div>
            <span className="text-sm font-semibold tabular-nums">{Number(m.value_cm).toFixed(1)} cm</span>
          </Card>
        ))}
        {measurements.data?.length === 0 && (
          <EmptyState>No measurements yet. Pick a type and log the first one.</EmptyState>
        )}
      </section>
    </div>
  );
}
