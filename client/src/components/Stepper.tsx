"use client";

import { Minus, Plus } from "lucide-react";

/** Large numeric field flanked by − / + for thumb-friendly amounts. */
export default function Stepper({ value, onChange, step = 1, min = 0, label, unit }: { value: string; onChange: (value: string) => void; step?: number; min?: number; label: string; unit?: string }) {
  const nudge = (delta: number) => {
    const current = Number(value);
    const next = Math.max(min, (Number.isFinite(current) ? current : 0) + delta);
    onChange(String(Math.round(next * 100) / 100));
  };
  const button = "press flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-foreground disabled:opacity-40";
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={button} aria-label={`Decrease ${label}`} disabled={Number(value) <= min} onClick={() => nudge(-step)}>
        <Minus className="size-5" />
      </button>
      <label className="flex min-w-0 flex-1 items-baseline justify-center gap-1.5 rounded-2xl bg-muted/70 px-3 py-2 focus-within:bg-card focus-within:ring-4 focus-within:ring-foreground/[0.06]">
        <input
          aria-label={label}
          className="w-full min-w-0 bg-transparent text-center text-3xl font-extrabold tabular-nums outline-none"
          style={{ maxWidth: `${Math.max(2, value.length) + 1}ch` }}
          type="number"
          inputMode="decimal"
          min={min}
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
        {unit && <span className="text-sm font-semibold text-muted-foreground">{unit}</span>}
      </label>
      <button type="button" className={button} aria-label={`Increase ${label}`} onClick={() => nudge(step)}>
        <Plus className="size-5" />
      </button>
    </div>
  );
}
