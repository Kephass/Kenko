"use client";

import { useState } from "react";
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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Measurements</h1>
      <p className="text-sm text-neutral-500">
        Waist + neck (+ hip) also drive the Navy body-fat estimate used for BMR.
      </p>

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
        <select
          className="rounded border px-3 py-2 dark:bg-neutral-900 dark:border-neutral-700"
          value={type}
          onChange={(e) => setType(e.target.value as MeasurementType)}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          className="flex-1 rounded border px-3 py-2 dark:bg-neutral-900 dark:border-neutral-700"
          type="number"
          step="0.1"
          placeholder="cm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={add.isPending || !value}
        >
          Log
        </button>
      </form>
      {add.isError && <p className="text-sm text-red-600">{String(add.error)}</p>}

      <ul className="space-y-1 text-sm">
        {(measurements.data ?? []).map((m) => (
          <li key={m.id} className="flex justify-between border-b py-1 last:border-0 dark:border-neutral-800">
            <span>
              {m.measurement_type}
              <span className="ml-2 text-neutral-500">
                {new Date(m.logged_at).toLocaleDateString()}
              </span>
            </span>
            <span className="tabular-nums">{Number(m.value_cm).toFixed(1)} cm</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
