"use client";

import { useState } from "react";
import { useAddWater, useTodayWater } from "@/hooks/useWaterLogs";

const QUICK = [250, 500, 750];

export default function WaterPage() {
  const [custom, setCustom] = useState("");
  const water = useTodayWater();
  const add = useAddWater();

  const total = (water.data ?? []).reduce((sum, w) => sum + Number(w.amount_ml), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Water</h1>
      <p className="text-3xl tabular-nums">
        {total} <span className="text-base text-neutral-500">ml today</span>
      </p>

      <div className="flex gap-2">
        {QUICK.map((ml) => (
          <button
            key={ml}
            className="flex-1 rounded border px-3 py-3 text-sm disabled:opacity-50 dark:border-neutral-700"
            disabled={add.isPending}
            onClick={() => add.mutate(ml)}
          >
            +{ml} ml
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom) add.mutate(Number(custom), { onSuccess: () => setCustom("") });
        }}
      >
        <input
          className="flex-1 rounded border px-3 py-2 dark:bg-neutral-900 dark:border-neutral-700"
          type="number"
          placeholder="Custom amount (ml)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <button
          className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={add.isPending || !custom}
        >
          Log
        </button>
      </form>
      {add.isError && <p className="text-sm text-red-600">{String(add.error)}</p>}

      <ul className="space-y-1 text-sm text-neutral-500">
        {(water.data ?? []).map((w) => (
          <li key={w.id} className="tabular-nums">
            {new Date(w.logged_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
            {Number(w.amount_ml)} ml
          </li>
        ))}
      </ul>
    </div>
  );
}
