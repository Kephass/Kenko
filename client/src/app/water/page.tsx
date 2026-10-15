"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassWater } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProgressRing from "@/components/ProgressRing";
import BackButton from "@/components/BackButton";
import { useSession } from "@/components/Providers";
import { useWriteWater, useWaterForDay, waterTotal } from "@/hooks/useWaterLogs";
import { useTargetHistory } from "@/hooks/useTargetHistory";
import { diaryDate, localDateTime, logTimestamp } from "@/lib/tracking";
import { errorMessage, formatTime, localDateISO } from "@/lib/utils";
import type { Tables } from "@/lib/types";

import { formatWater, waterFromMl, waterToMl, waterUnitLabel, type WaterUnit } from "@/lib/waterUnits";
import { useWaterPreferences } from "@/hooks/useWaterPreferences";
import WaterContainers from "@/components/WaterContainers";

function WaterEntry({ row, unit, onDeleted }: { unit: WaterUnit; row: Tables<"water_logs">; onDeleted: (row: Tables<"water_logs">) => void }) {
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState(() => localDateTime(new Date(row.logged_at)));
  const [amount, setAmount] = useState(String(waterFromMl(Number(row.amount_ml), unit)));
  const [error, setError] = useState("");
  const write = useWriteWater();
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold"><GlassWater className="size-4 text-water" />{formatWater(Number(row.amount_ml), unit)}</span>
        <span className="text-xs text-muted-foreground">{formatTime(row.logged_at)}</span>
        <Button variant="ghost" size="sm" onClick={() => { setEditing(!editing); setWhen(localDateTime(new Date(row.logged_at))); setAmount(String(waterFromMl(Number(row.amount_ml), unit))); }}>Edit</Button>
      </div>
      {editing && (
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          try {
            const amount_ml = waterToMl(amount, unit);
            write.mutate({ operation: "update", row: { ...row, amount_ml, logged_at: logTimestamp(when) } });
            setError(""); setEditing(false);
          } catch (e) { setError(errorMessage(e)); }
        }}>
          <Label htmlFor={`water-time-${row.id}`}>Date and time</Label>
          <Input id={`water-time-${row.id}`} required type="datetime-local" max={localDateTime()} value={when} onChange={e => setWhen(e.target.value)} />
          <Label htmlFor={`water-${row.id}`}>Amount ({waterUnitLabel(unit)})</Label>
          <Input id={`water-${row.id}`} required type="number" min="0.1" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" disabled={write.isPending}>Save</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={write.isPending} onClick={() => { onDeleted(row); write.mutate({ operation: "delete", row }); }}>Delete</Button>
          </div>
        </form>
      )}
      {(error || write.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(write.error)}</p>}
    </Card>
  );
}

export default function WaterPage() {
  return <Suspense fallback={<p role="status">Loading water logger…</p>}><DatedWaterLogger /></Suspense>;
}
function DatedWaterLogger() {
  const params = useSearchParams();
  const day = diaryDate(params.get("date"), localDateISO());
  return <WaterLogger key={day} initialDay={day} />;
}
function WaterLogger({ initialDay }: { initialDay: string }) {
  const session = useSession();
  const { preferences, save: savePreferences, syncError } = useWaterPreferences(session?.user.id);
  const { unit, containers } = preferences;
  const [editingContainers, setEditingContainers] = useState(false);
  const router = useRouter();
  const day = initialDay;
  const [custom, setCustom] = useState("");
  const [deletedWater, setDeletedWater] = useState<Tables<"water_logs"> | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const water = useWaterForDay(day);
  const write = useWriteWater();
  const total = waterTotal(water.data);
  const targetHistory = useTargetHistory(day, localDateISO());
  const recordedGoals = targetHistory.forDay(day);
  const goal = (recordedGoals ?? targetHistory.current).water;

  function add(amount: string | number, inputUnit: WaterUnit = unit) {
    try {
      if (!session) throw new Error("Sign in to log water.");
      const amount_ml = waterToMl(amount, inputUnit);
      const logged_at = day === localDateISO() ? new Date().toISOString() : logTimestamp(`${day}T12:00`);
      write.mutate({ operation: "add", row: { id: crypto.randomUUID(), user_id: session.user.id, amount_ml, logged_at } });
      setCustom(""); setError(""); setMessage(`${formatWater(amount_ml, unit)} added.`);
    } catch (e) { setError(errorMessage(e)); }
  }

  return (
    <div className="space-y-5">
      <div className="relative flex items-center justify-center pt-1">
        <div className="absolute left-0"><BackButton /></div>
        <h1 className="text-xl font-extrabold tracking-tight">Water</h1>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="water-day">Tracking date</Label>
        <Input id="water-day" type="date" max={localDateISO()} value={day} onChange={(e) => { if (e.target.value && diaryDate(e.target.value, "") === e.target.value) router.replace(`/water?date=${e.target.value}`, { scroll: false }); }} />
        {day !== localDateISO() && <p className="text-xs text-muted-foreground">New entries for a past day start at noon; you can edit their time. {recordedGoals ? "Progress uses the water goal recorded on this day." : "No saved target is available; comparing with your current water goal."}</p>}
      </div>
      {water.isLoading && <p role="status">Loading water entries…</p>}
      {water.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(water.error)}</p>}
      {targetHistory.isError && <p role="alert" className="text-xs text-destructive">Historical targets could not be loaded. Any available cached targets are shown; other comparisons use current targets.</p>}
      {water.isPending || water.isError ? <Card className="p-6"><p className="text-lg font-semibold">{water.isPending ? "Loading water total…" : "Water total unavailable"}</p><p className="text-sm text-muted-foreground">Your goal is {formatWater(goal, unit)}.</p></Card> : <Card className="flex-row items-center justify-between p-6">
        <div>
          <p className="text-4xl font-extrabold tabular-nums">{waterFromMl(total, unit).toLocaleString(undefined, { maximumFractionDigits: unit === "ml" ? 0 : 1 })} <span className="text-lg text-muted-foreground">{waterUnitLabel(unit)}</span></p>
          <p className="mt-1 text-sm text-muted-foreground">of {formatWater(goal, unit)} {day === localDateISO() ? "today" : "on this day"}</p>
          <p className="mt-1 text-sm">{total >= goal ? "Goal reached" : `${formatWater(goal - total, unit)} to go`}</p>
          <Link href="/settings" className="text-xs underline text-muted-foreground">Change goal</Link>
        </div>
        <ProgressRing value={total / goal} size={80} stroke={8} className="text-water"><GlassWater className="size-6" /></ProgressRing>
      </Card>
      }
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1"><Label htmlFor="water-unit">Water unit</Label><select id="water-unit" className="h-11 rounded-xl border bg-card px-3 text-sm" value={unit} onChange={e => {
          try {
            const next = e.target.value as WaterUnit;
            const converted = custom && Number(custom) > 0 ? String(waterFromMl(waterToMl(custom, unit), next)) : custom;
            savePreferences({ ...preferences, unit: next }); setCustom(converted); setEditingContainers(false); setError("");
          } catch (e) { setError(errorMessage(e)); }
        }}><option value="ml">Millilitres</option><option value="us-fl-oz">US fluid ounces</option></select></div>
        <Button variant="ghost" onClick={() => setEditingContainers(!editingContainers)}>Edit containers</Button>
      </div>
      {syncError && <p role="alert" className="text-xs text-destructive">Unable to load synced water preferences. Your browser’s saved containers are available. {errorMessage(syncError)}</p>}
      {editingContainers && <WaterContainers key={unit} preferences={preferences} onSave={value => { savePreferences(value); setEditingContainers(false); }} onCancel={() => setEditingContainers(false)} />}
      <div className="grid grid-cols-3 gap-2">
        {containers.map((container, index) => <Button key={index} variant="secondary" className="h-auto min-h-16 flex-col gap-1 whitespace-normal rounded-2xl bg-card px-2 py-3" disabled={write.isPending && !write.isPaused} onClick={() => add(container.ml, "ml")}><span className="text-xs">{container.name}</span><span>+{formatWater(container.ml, unit)}</span></Button>)}
      </div>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); add(custom); }}>
        <Label htmlFor="custom-water">Custom amount ({waterUnitLabel(unit)})</Label>
        <div className="flex gap-2">
          <Input id="custom-water" className="h-12 rounded-full bg-card px-5" required type="number" min="0.1" step="any" placeholder={unit === "ml" ? "e.g. 330" : "e.g. 12"} value={custom} onChange={(e) => setCustom(e.target.value)} />
          <Button className="h-12 rounded-full px-6" disabled={(write.isPending && !write.isPaused) || !custom}>Log</Button>
        </div>
      </form>
      {(error || write.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(write.error)}</p>}
      <p role="status" className="text-sm text-muted-foreground">{message}{write.isPaused ? " Waiting to sync." : ""}</p>
      {deletedWater && <div className="flex items-center justify-between rounded-xl bg-card p-3 text-sm" role="status">
        <span>Water entry deleted.</span><Button variant="secondary" size="sm" onClick={() => { write.mutate({ operation: "add", row: deletedWater }); setDeletedWater(null); }}>Undo</Button>
      </div>}
      <Link href={`/?date=${day}`} className="block text-center text-sm underline">View this day’s diary</Link>
      <section className="space-y-3" aria-label="Water entries">
        {!water.isLoading && !water.isError && !water.data?.length && <p className="text-sm text-muted-foreground">No water logged on this day yet.</p>}
        {(water.data ?? []).map((w) => <WaterEntry key={`${w.id}-${unit}`} unit={unit} row={w} onDeleted={setDeletedWater} />)}
      </section>
    </div>
  );
}
