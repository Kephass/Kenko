"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { waterFromMl, waterToMl, waterUnitLabel, type WaterPreferences } from "@/lib/waterUnits";
import { errorMessage } from "@/lib/utils";

export default function WaterContainers({ preferences, onSave, onCancel }: { preferences: WaterPreferences; onSave: (value: WaterPreferences) => void; onCancel: () => void }) {
  const [rows, setRows] = useState(() => preferences.containers.map(c => ({ name: c.name, amount: String(waterFromMl(c.ml, preferences.unit)) })));
  const [error, setError] = useState("");
  return <form className="space-y-3 rounded-xl border p-4" onSubmit={e => {
    e.preventDefault();
    try {
      const containers = rows.map(row => {
        if (!row.name.trim()) throw new Error("Give each container a name.");
        return { name: row.name.trim(), ml: waterToMl(row.amount, preferences.unit) };
      });
      onSave({ ...preferences, containers });
    } catch (e) { setError(errorMessage(e)); }
  }}>
    <p className="font-semibold">Your water containers</p>
    {rows.map((row, index) => <div key={index} className="grid grid-cols-2 gap-3">
      <div className="space-y-1"><Label htmlFor={`container-name-${index}`}>Container {index + 1}</Label><Input id={`container-name-${index}`} required maxLength={40} value={row.name} onChange={e => setRows(rows.map((r, i) => i === index ? { ...r, name: e.target.value } : r))} /></div>
      <div className="space-y-1"><Label htmlFor={`container-size-${index}`}>Size ({waterUnitLabel(preferences.unit)})</Label><Input id={`container-size-${index}`} required type="number" min="0.01" step="any" value={row.amount} onChange={e => setRows(rows.map((r, i) => i === index ? { ...r, amount: e.target.value } : r))} /></div>
    </div>)}
    <p className="text-xs text-muted-foreground">Save to sync these containers across your devices. Offline changes will sync when you reconnect.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button type="submit">Save containers</Button><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button></div>
  </form>;
}
