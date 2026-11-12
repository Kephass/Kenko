"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, CalendarDays, ChevronRight, Droplets, GlassWater, Milk, Pencil, Plus, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import ProgressRing from "@/components/ProgressRing";
import AnimatedNumber from "@/components/AnimatedNumber";
import { pourWater } from "@/components/WaterDrops";
import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import { Segmented } from "@/components/Chips";
import { toast } from "@/components/Toaster";
import { useSession } from "@/components/Providers";
import { useWriteWater, useWaterForDay, waterTotal } from "@/hooks/useWaterLogs";
import { useTargetHistory } from "@/hooks/useTargetHistory";
import { diaryDate, localDateTime, logTimestamp } from "@/lib/tracking";
import { errorMessage, formatTime, localDateISO } from "@/lib/utils";
import type { Tables } from "@/lib/types";
import { formatWater, waterFromMl, waterToMl, waterUnitLabel, type WaterUnit } from "@/lib/waterUnits";
import { useWaterPreferences } from "@/hooks/useWaterPreferences";
import WaterContainers from "@/components/WaterContainers";

type WaterRow = Tables<"water_logs">;

const UNITS = [
  { value: "ml", label: <span className="normal-case">ml</span> },
  { value: "us-fl-oz", label: <span className="normal-case">fl oz</span> },
] as const;
const CONTAINER_ICONS = [GlassWater, Milk, Droplets];
const chip = "press inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-sm font-medium shadow-soft ring-1 ring-black/[0.04]";

function WaterSkeleton() {
  return (
    <div className="space-y-5" role="status">
      <span className="sr-only">Loading water logger…</span>
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-44 rounded-3xl" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-3xl" />)}
      </div>
      <Skeleton className="h-12 rounded-full" />
    </div>
  );
}

/** Edit form for one entry; the Sheet footer submits it by form id. */
function EntryForm({ row, unit, formId, onSave }: { row: WaterRow; unit: WaterUnit; formId: string; onSave: (row: WaterRow) => void }) {
  const [when, setWhen] = useState(() => localDateTime(new Date(row.logged_at)));
  const [amount, setAmount] = useState(() => String(waterFromMl(Number(row.amount_ml), unit)));
  const [error, setError] = useState("");
  return (
    <form
      id={formId}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          onSave({ ...row, amount_ml: waterToMl(amount, unit), logged_at: logTimestamp(when) });
        } catch (e) {
          setError(errorMessage(e));
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`water-${row.id}`} className="text-xs text-muted-foreground">Amount ({waterUnitLabel(unit)})</Label>
        <Input id={`water-${row.id}`} required type="number" inputMode="decimal" min="0.1" step="any" className="text-lg font-bold tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`water-time-${row.id}`} className="text-xs text-muted-foreground">Date and time</Label>
        <Input id={`water-time-${row.id}`} required type="datetime-local" max={localDateTime()} value={when} onChange={(e) => setWhen(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  );
}

export default function WaterPage() {
  return <Suspense fallback={<WaterSkeleton />}><DatedWaterLogger /></Suspense>;
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
  const [editing, setEditing] = useState<WaterRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const router = useRouter();
  const day = initialDay;
  const today = localDateISO();
  const isToday = day === today;
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const water = useWaterForDay(day);
  const write = useWriteWater();
  const total = waterTotal(water.data);
  const targetHistory = useTargetHistory(day, today);
  const recordedGoals = targetHistory.forDay(day);
  const goal = (recordedGoals ?? targetHistory.current).water;
  const busy = write.isPending && !write.isPaused;
  const dayLabel = isToday ? "Today" : new Date(`${day}T12:00`).toLocaleDateString([], { month: "short", day: "numeric" });

  function add(amount: string | number, inputUnit: WaterUnit = unit) {
    try {
      if (!session) throw new Error("Sign in to log water.");
      const amount_ml = waterToMl(amount, inputUnit);
      const logged_at = isToday ? new Date().toISOString() : logTimestamp(`${day}T12:00`);
      const row = { id: crypto.randomUUID(), user_id: session.user.id, amount_ml, logged_at };
      write.mutate({ operation: "add", row });
      setCustom(""); setError("");
      toast(`${formatWater(amount_ml, unit)} added`, { label: "Undo", onClick: () => write.mutate({ operation: "delete", row }) });
    } catch (e) { setError(errorMessage(e)); }
  }

  function remove(row: WaterRow) {
    setEditOpen(false);
    write.mutate({ operation: "delete", row });
    toast("Entry deleted", { label: "Undo", onClick: () => write.mutate({ operation: "add", row }) });
  }

  function changeUnit(next: WaterUnit) {
    try {
      const converted = custom && Number(custom) > 0 ? String(waterFromMl(waterToMl(custom, unit), next)) : custom;
      savePreferences({ ...preferences, unit: next }); setCustom(converted); setError("");
    } catch (e) { setError(errorMessage(e)); }
  }

  const entries = water.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Water"
        back
        action={
          <label className={`${chip} relative cursor-pointer`}>
            <CalendarDays className="size-4 text-muted-foreground" />
            {dayLabel}
            <input
              id="water-day"
              aria-label="Tracking date"
              type="date"
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              max={today}
              value={day}
              onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* picker needs a user gesture */ } }}
              onChange={(e) => { if (e.target.value && diaryDate(e.target.value, "") === e.target.value) router.replace(`/water?date=${e.target.value}`, { scroll: false }); }}
            />
          </label>
        }
      />

      {water.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(water.error)}</p>}
      {targetHistory.isError && <p role="alert" className="text-xs text-destructive">Historical targets could not be loaded; using cached or current targets.</p>}

      {water.isPending ? (
        <div role="status"><span className="sr-only">Loading water total…</span><Skeleton className="h-44 rounded-3xl" /></div>
      ) : water.isError ? (
        <Card className="gap-1 p-6">
          <p className="text-lg font-bold">Water total unavailable</p>
          <p className="text-sm text-muted-foreground">Your goal is {formatWater(goal, unit)}.</p>
        </Card>
      ) : (
        <Card className="flex-row items-center justify-between gap-4 p-6">
          <div className="min-w-0 space-y-3">
            <div>
              <p className="text-5xl leading-none font-extrabold tracking-tight tabular-nums">
                <AnimatedNumber value={waterFromMl(total, unit)} decimals={unit === "ml" ? 0 : 1} />
                <span className="ml-1.5 text-base font-semibold tracking-normal text-muted-foreground">{waterUnitLabel(unit)}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">of {formatWater(goal, unit)} {isToday ? "today" : "on this day"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ${total >= goal ? "bg-fiber/10 text-fiber" : "bg-water/10 text-water"}`}>
                {total >= goal ? "Goal reached" : `${formatWater(goal - total, unit)} to go`}
              </span>
              <Link href="/settings" className="press inline-flex h-7 items-center gap-1 rounded-full bg-muted px-3 text-xs font-semibold text-muted-foreground">
                <Target className="size-3.5" />Change goal
              </Link>
            </div>
          </div>
          <span data-water-target className="inline-flex">
            <ProgressRing value={total / goal} size={104} stroke={10} className="text-water">
              <GlassWater className="size-7 text-water" />
            </ProgressRing>
          </span>
        </Card>
      )}

      {!isToday && (
        <p className="px-1 text-xs text-muted-foreground">
          New entries start at noon. {recordedGoals ? "Using this day’s recorded goal." : "No saved goal for this day; using your current one."}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {containers.map((container, index) => {
          const Icon = CONTAINER_ICONS[index % CONTAINER_ICONS.length];
          return (
            <button
              key={index}
              type="button"
              disabled={busy}
              onClick={(event) => {
                const ring = document.querySelector("[data-water-target]");
                if (ring) pourWater(event.currentTarget, ring, { amount: 12 });
                add(container.ml, "ml");
              }}
              aria-label={`Add ${container.name}, ${formatWater(container.ml, unit)}`}
              className="press flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl bg-card px-2 py-4 shadow-soft ring-1 ring-black/[0.04] disabled:opacity-50"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-water/10 text-water"><Icon className="size-5" /></span>
              <span className="text-base leading-none font-extrabold tabular-nums">+{formatWater(container.ml, unit)}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{container.name}</span>
            </button>
          );
        })}
      </div>

      <form className="flex items-center gap-2 rounded-full bg-card p-1.5 pl-5 shadow-soft ring-1 ring-black/[0.04]" onSubmit={(e) => { e.preventDefault(); add(custom); }}>
        <Label htmlFor="custom-water" className="sr-only">Custom amount ({waterUnitLabel(unit)})</Label>
        <input
          id="custom-water"
          className="h-10 min-w-0 flex-1 bg-transparent text-base font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground/70"
          required
          type="number"
          inputMode="decimal"
          min="0.1"
          step="any"
          placeholder={`Custom amount (${waterUnitLabel(unit)})`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button disabled={busy || !custom}><Plus />Log</Button>
      </form>

      <div className="flex items-center justify-between gap-3">
        <Segmented label="Water unit" size="sm" className="w-36" options={UNITS} value={unit} onChange={changeUnit} />
        <Button variant="secondary" size="sm" onClick={() => setEditingContainers(true)}><Pencil />Edit containers</Button>
      </div>

      {syncError && <p role="alert" className="text-xs text-destructive">Unable to load synced water preferences. Your browser’s saved containers are available. {errorMessage(syncError)}</p>}
      {(error || write.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(write.error)}</p>}
      {write.isPaused && <p role="status" className="px-1 text-xs text-muted-foreground">Waiting to sync.</p>}

      <section className="space-y-3" aria-label="Water entries">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-extrabold tracking-tight">Entries</h2>
          <Link href={`/?date=${day}`} className={`${chip} h-8 px-3 text-xs`}><BookOpen className="size-3.5 text-muted-foreground" />Diary</Link>
        </div>
        {water.isLoading && (
          <div role="status" className="space-y-2">
            <span className="sr-only">Loading water entries…</span>
            <Skeleton className="h-16 rounded-3xl" />
            <Skeleton className="h-16 rounded-3xl" />
          </div>
        )}
        {!water.isLoading && !water.isError && !entries.length && (
          <Card className="items-center gap-2 p-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-water/10 text-water"><Droplets className="size-5" /></span>
            <p className="text-sm text-muted-foreground">No water logged on this day yet.</p>
          </Card>
        )}
        {entries.length > 0 && (
          <Card className="relative gap-0 divide-y divide-black/[0.05] py-0">
            <AnimatePresence initial={false} mode="popLayout">
              {entries.map((w) => (
                <motion.button
                  key={w.id}
                  layout
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", damping: 30, stiffness: 380 }}
                  onClick={() => { setEditing(w); setEditOpen(true); }}
                  aria-label={`Edit ${formatWater(Number(w.amount_ml), unit)} at ${formatTime(w.logged_at)}`}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/60"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-water/10 text-water"><GlassWater className="size-4.5" /></span>
                  <span className="flex-1 text-base font-bold tabular-nums">{formatWater(Number(w.amount_ml), unit)}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{formatTime(w.logged_at)}</span>
                  <ChevronRight className="size-4 text-muted-foreground/60" />
                </motion.button>
              ))}
            </AnimatePresence>
          </Card>
        )}
      </section>

      <Sheet open={editingContainers} onOpenChange={setEditingContainers} title="Your containers" description="Three quick-add sizes.">
        <WaterContainers key={unit} preferences={preferences} onSave={(value) => { savePreferences(value); setEditingContainers(false); toast("Containers saved"); }} onCancel={() => setEditingContainers(false)} />
      </Sheet>

      <Sheet
        open={editOpen && !!editing}
        onOpenChange={setEditOpen}
        title="Edit entry"
        footer={editing && (
          <div className="flex gap-2">
            <Button type="button" variant="destructive" size="lg" disabled={busy} onClick={() => remove(editing)}>Delete</Button>
            <Button type="submit" form="water-entry-form" size="lg" className="flex-1" disabled={busy}>Save</Button>
          </div>
        )}
      >
        {editing && (
          <EntryForm
            key={`${editing.id}-${unit}`}
            row={editing}
            unit={unit}
            formId="water-entry-form"
            onSave={(row) => { write.mutate({ operation: "update", row }); setEditOpen(false); toast("Entry updated"); }}
          />
        )}
      </Sheet>
    </div>
  );
}
