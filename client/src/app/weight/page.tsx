"use client";

import { useState } from "react";
import { useAddWeighIn, useWeighIns } from "@/hooks/useWeighIns";

export default function WeightPage() {
  const [weight, setWeight] = useState("");
  const weighIns = useWeighIns();
  const add = useAddWeighIn();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Weight</h1>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (weight) add.mutate(Number(weight), { onSuccess: () => setWeight("") });
        }}
      >
        <input
          className="flex-1 rounded border px-3 py-2 dark:bg-neutral-900 dark:border-neutral-700"
          type="number"
          step="0.1"
          placeholder="Weight (kg)"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <button
          className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={add.isPending || !weight}
        >
          Log
        </button>
      </form>
      {add.isError && <p className="text-sm text-red-600">{String(add.error)}</p>}

      {/* TODO: replace the table with a raw-vs-trend chart */}
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b text-left text-neutral-500 dark:border-neutral-700">
            <th className="py-1 font-medium">Date</th>
            <th className="py-1 text-right font-medium">Raw</th>
            <th className="py-1 text-right font-medium">Trend</th>
          </tr>
        </thead>
        <tbody>
          {(weighIns.data ?? []).map((w) => (
            <tr key={w.id} className="border-b last:border-0 dark:border-neutral-800">
              <td className="py-1">{new Date(w.logged_at).toLocaleDateString()}</td>
              <td className="py-1 text-right">{Number(w.weight_kg).toFixed(1)}</td>
              <td className="py-1 text-right">
                {w.trend_weight_kg ? Number(w.trend_weight_kg).toFixed(1) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {weighIns.data?.length === 0 && (
        <p className="text-sm text-neutral-500">No weigh-ins yet.</p>
      )}
    </div>
  );
}
