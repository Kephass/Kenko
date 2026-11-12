"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { waterFromMl, waterToMl, waterUnitLabel, type WaterPreferences } from "@/lib/waterUnits";
import { errorMessage } from "@/lib/utils";

/** Form for the three quick-add containers; designed to sit inside a Sheet. */
export default function WaterContainers({ preferences, onSave, onCancel }: { preferences: WaterPreferences; onSave: (value: WaterPreferences) => void; onCancel: () => void }) {
  const [rows, setRows] = useState(() => preferences.containers.map((c) => ({ name: c.name, amount: String(waterFromMl(c.ml, preferences.unit)) })));
  const [error, setError] = useState("");
  const patch = (index: number, change: Partial<(typeof rows)[number]>) => setRows(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const containers = rows.map((row) => {
            if (!row.name.trim()) throw new Error("Give each container a name.");
            return { name: row.name.trim(), ml: waterToMl(row.amount, preferences.unit) };
          });
          onSave({ ...preferences, containers });
        } catch (e) {
          setError(errorMessage(e));
        }
      }}
    >
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_7rem] gap-2">
          <div className="space-y-1.5">
            <Label htmlFor={`container-name-${index}`} className="text-xs text-muted-foreground">Container {index + 1}</Label>
            <Input id={`container-name-${index}`} required maxLength={40} value={row.name} onChange={(e) => patch(index, { name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`container-size-${index}`} className="text-xs text-muted-foreground">Size ({waterUnitLabel(preferences.unit)})</Label>
            <Input id={`container-size-${index}`} required type="number" inputMode="decimal" min="0.01" step="any" className="tabular-nums" value={row.amount} onChange={(e) => patch(index, { amount: e.target.value })} />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Syncs across your devices, even if saved offline.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" size="lg" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="lg" className="flex-1">Save containers</Button>
      </div>
    </form>
  );
}
