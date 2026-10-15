"use client";
import { useState } from "react";
import { useMutation, onlineManager } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "./Providers";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useWriteSavedMeal } from "@/hooks/useSavedMeals";
import { saveMealSnapshot } from "@/lib/savedMeals";
import { COPY_MEAL_KEY, makeMealCopy, type MealCopy } from "@/lib/copyMeal";
import { initialLogTime, localDateTime, type MealType } from "@/lib/tracking";
import { localDateISO, errorMessage } from "@/lib/utils";
import type { Tables } from "@/lib/types";

export default function CopyMeal({ rows, type }: { rows: Tables<"meal_logs">[]; type: MealType }) {
  const session = useSession();
  const saved = useWriteSavedMeal();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(() => initialLogTime(localDateISO()));
  const [error, setError] = useState("");
  const [destination, setDestination] = useState("");
  const copy = useMutation<void, Error, MealCopy>({ mutationKey: COPY_MEAL_KEY });
  return <div className="space-y-2">
    <Button variant="ghost" size="sm" onClick={() => { setOpen(!open); setDestination(""); }}>Copy this meal</Button>
    <Button variant="ghost" size="sm" onClick={() => { setSaveOpen(!saveOpen); setSaveMessage(""); }}>Save as a meal</Button>
    {saveOpen && <form className="space-y-3 rounded-xl border p-3" onSubmit={e => {
      e.preventDefault();
      try {
        if (!session) throw new Error("Sign in to save a meal.");
        const row = saveMealSnapshot(rows, session.user.id, name, type);
        setError("");
        saved.mutate({ operation: "add", row }, { onSuccess: () => { setSaveOpen(false); setSaveMessage("Meal saved."); } });
        if (!onlineManager.isOnline()) { setSaveOpen(false); setSaveMessage("Meal saved on this device, waiting to sync."); }
      } catch (e) { setError(errorMessage(e)); }
    }}><Label htmlFor={`save-meal-${type}`}>Meal name</Label><Input id={`save-meal-${type}`} required maxLength={120} placeholder="e.g. My usual breakfast" value={name} onChange={e => setName(e.target.value)} /><Button disabled={saved.isPending && !saved.isPaused}>Save {rows.length} foods</Button></form>}
    {saved.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(saved.error)}</p>}
    {saveMessage && !saved.isError && <p role="status" className="text-sm">{saveMessage} <Link href="/meals" className="underline">View saved meals</Link></p>}
    {open && <form className="space-y-3 rounded-xl border p-3" onSubmit={e => {
      e.preventDefault();
      try {
        if (!session) throw new Error("Sign in to copy a meal.");
        const input = makeMealCopy(rows, session.user.id, when, type);
        setError("");
        const done = () => { setDestination(when.slice(0, 10)); setOpen(false); };
        copy.mutate(input, { onSuccess: done });
        if (!onlineManager.isOnline()) done();
      } catch (e) { setError(errorMessage(e)); }
    }}>
      <p className="text-sm">Copy all {rows.length} foods with their current portions and nutrition. Each food stays individually editable.</p>
      <Label htmlFor={`copy-${type}`}>Date and time for the copy</Label><Input id={`copy-${type}`} required type="datetime-local" max={localDateTime()} value={when} onChange={e => setWhen(e.target.value)} />
      <Button type="submit" disabled={copy.isPending && !copy.isPaused}>Copy {rows.length} foods</Button>
    </form>}
    {(error || copy.isError) && <p role="alert" className="text-sm text-destructive">{error || errorMessage(copy.error)}</p>}
    {destination && !copy.isError && <p role="status" className="text-sm">{copy.isPaused ? "Copy waiting to sync." : "Meal copied."} <Link className="underline" href={`/?date=${destination}`}>Open destination diary</Link></p>}
  </div>;
}
