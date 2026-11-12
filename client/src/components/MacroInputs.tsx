"use client";

import { Leaf } from "lucide-react";
import { MACROS } from "@/lib/macros";

const FIELDS = [...MACROS, { key: "fiber", label: "Fiber", colorClass: "text-fiber", Icon: Leaf }];

/** Optional nutrient grams; blank means unknown, 0 means none. */
export default function MacroInputs({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {FIELDS.map(({ key, label, colorClass, Icon }) => (
        <label key={key} className="rounded-2xl bg-muted/70 px-1 py-2.5 text-center transition-[background-color,box-shadow] duration-200 focus-within:bg-card focus-within:ring-4 focus-within:ring-foreground/[0.06]">
          <span className={`flex items-center justify-center gap-1 text-[11px] font-semibold ${colorClass}`}>
            <Icon className="size-3" />
            {label}
          </span>
          <input
            className="mt-0.5 w-full bg-transparent text-center text-lg font-extrabold tabular-nums outline-none placeholder:text-muted-foreground/40"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            aria-label={`${label} in grams (optional)`}
            placeholder="–"
            value={values[key] ?? ""}
            onChange={(e) => onChange(key, e.target.value)}
          />
          <span className="block text-[10px] text-muted-foreground">grams</span>
        </label>
      ))}
    </div>
  );
}
