"use client";

import { Input } from "@/components/ui/input";
import { MACROS } from "@/lib/macros";

export default function MacroInputs({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {MACROS.map(({ key, label, colorClass, Icon }) => (
        <div key={key} className="rounded-2xl bg-muted/60 p-3 text-center">
          <Icon className={`mx-auto size-4 ${colorClass}`} />
          <Input
            className="mt-1 h-8 border-0 bg-card text-center text-sm font-bold tabular-nums shadow-none"
            type="number"
            inputMode="decimal"
            value={values[key]}
            onChange={(e) => onChange(key, e.target.value)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">{label} (g)</p>
        </div>
      ))}
    </div>
  );
}
