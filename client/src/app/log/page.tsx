"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { onlineManager } from "@tanstack/react-query";
import { Camera, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddManualMealLog,
  useConfirmMealLog,
  useDiscardMealLog,
  useLogMeal,
} from "@/hooks/useMealLogs";
import { useDishes } from "@/hooks/useDishes";
import BackButton from "@/components/BackButton";
import MacroInputs from "@/components/MacroInputs";
import { errorMessage } from "@/lib/utils";

const MODES = [
  { key: "scan", label: "Scan" },
  { key: "manual", label: "Manual" },
] as const;

// Camera/text -> POST log-meal -> confirm screen; confirming is an UPDATE on
// the draft row, and failed captures stay in state for an explicit retry.
export default function LogPage() {
  const router = useRouter();
  const [mode, setMode] = useState<(typeof MODES)[number]["key"]>("scan");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [text, setText] = useState("");
  const logMeal = useLogMeal();
  const confirm = useConfirmMealLog();
  const discard = useDiscardMealLog();

  // Manual mode state
  const dishes = useDishes();
  const [dishId, setDishId] = useState("");
  const [grams, setGrams] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualMacros, setManualMacros] = useState({ protein: "", carbs: "", fat: "" });
  const addManual = useAddManualMealLog();

  // Confirm-screen edits, seeded when a draft arrives
  const [edits, setEdits] = useState<Record<string, string> | null>(null);

  const draft = logMeal.data;
  const dish = dishes.data?.find((d) => d.id === dishId);
  const dishGrams = Number(grams) || Number(dish?.reference_serving_g) || 0;
  const scale = dish ? dishGrams / 100 : 0;

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageBase64(result.split(",")[1] ?? null); // strip the data: prefix
    };
    reader.readAsDataURL(file);
  }

  function submit() {
    logMeal.mutate(
      { imageBase64: imageBase64 ?? undefined, textInput: text || undefined },
      { onSuccess: () => setEdits(null) },
    );
  }

  function reset() {
    setImageBase64(null);
    setText("");
    setEdits(null);
    logMeal.reset();
  }

  function submitManual() {
    const input = dish
      ? {
          id: crypto.randomUUID(),
          dish_id: dish.id,
          portion_ratio: dish.reference_serving_g ? dishGrams / Number(dish.reference_serving_g) : undefined,
          calories: Number(dish.calories_per_100g) * scale,
          protein_g: Number(dish.protein_g_per_100g ?? 0) * scale,
          carbs_g: Number(dish.carbs_g_per_100g ?? 0) * scale,
          fat_g: Number(dish.fat_g_per_100g ?? 0) * scale,
        }
      : {
          id: crypto.randomUUID(),
          calories: Number(manualCalories),
          protein_g: Number(manualMacros.protein) || 0,
          carbs_g: Number(manualMacros.carbs) || 0,
          fat_g: Number(manualMacros.fat) || 0,
          raw_text_input: manualNote || undefined,
        };
    addManual.mutate(input, { onSuccess: () => router.push("/") });
    // Offline the mutation pauses (no onSuccess); the optimistic insert already
    // put it on the dashboard, so head there instead of hanging on "Logging…".
    if (!onlineManager.isOnline()) router.push("/");
  }

  if (draft && !confirm.isSuccess) {
    const current = edits ?? {
      calories: String(Math.round(Number(draft.calories))),
      protein: String(Math.round(Number(draft.protein_g ?? 0))),
      carbs: String(Math.round(Number(draft.carbs_g ?? 0))),
      fat: String(Math.round(Number(draft.fat_g ?? 0))),
    };
    const setField = (key: string, value: string) => setEdits({ ...current, [key]: value });

    return (
      <div className="space-y-5">
        <div className="relative flex items-center justify-center pt-1">
          <div className="absolute left-0"><BackButton /></div>
          <h1 className="text-xl font-extrabold tracking-tight">Confirm this meal?</h1>
        </div>

        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              <Flame className="size-5" />
            </span>
            <Input
              className="h-12 w-32 border-0 bg-muted/60 text-3xl font-extrabold tabular-nums shadow-none"
              type="number"
              inputMode="numeric"
              value={current.calories}
              onChange={(e) => setField("calories", e.target.value)}
            />
            <span className="text-base font-semibold text-muted-foreground">cal</span>
          </div>
          <MacroInputs values={current} onChange={setField} />
          {draft.match_confidence && (
            <p className="text-xs text-muted-foreground">
              Match confidence {(Number(draft.match_confidence) * 100).toFixed(0)}% — adjust anything that looks off
            </p>
          )}
        </Card>

        <div className="flex gap-2">
          <Button
            className="h-12 flex-1 rounded-full"
            disabled={confirm.isPending}
            onClick={() =>
              confirm.mutate(
                {
                  id: draft.id,
                  edits: {
                    calories: Number(current.calories) || 0,
                    protein_g: Number(current.protein) || 0,
                    carbs_g: Number(current.carbs) || 0,
                    fat_g: Number(current.fat) || 0,
                  },
                },
                { onSuccess: reset },
              )
            }
          >
            Confirm
          </Button>
          <Button
            variant="secondary"
            className="h-12 flex-1 rounded-full bg-card shadow-soft"
            disabled={discard.isPending}
            onClick={() => discard.mutate(draft.id, { onSuccess: reset })}
          >
            Discard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative flex items-center justify-center pt-1">
        <div className="absolute left-0"><BackButton /></div>
        <h1 className="text-xl font-extrabold tracking-tight">Log a meal</h1>
      </div>

      <div className="flex gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={`h-10 flex-1 rounded-full text-sm font-semibold transition-colors ${
              mode === m.key ? "bg-foreground text-background" : "bg-card text-muted-foreground shadow-soft"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "scan" && (
        <>
          <label className="block cursor-pointer">
            <Card className="flex flex-col items-center gap-3 p-10 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-foreground text-background">
                <Camera className="size-6" />
              </span>
              <div>
                <p className="font-semibold">{imageBase64 ? "Photo captured ✓" : "Scan your meal"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {imageBase64 ? "Tap to retake" : "Fit the whole plate in frame with good lighting"}
                </p>
              </div>
            </Card>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>

          <textarea
            className="w-full rounded-3xl border-0 bg-card p-4 text-sm shadow-soft outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            rows={2}
            placeholder="Describe what you ate (optional)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <Button
            className="h-12 w-full rounded-full"
            disabled={logMeal.isPending || (!imageBase64 && !text)}
            onClick={submit}
          >
            {logMeal.isPending ? "Analyzing…" : "Analyze meal"}
          </Button>

          {logMeal.isError && (
            <Card className="space-y-2 p-4 text-sm">
              <p className="font-medium text-destructive">{errorMessage(logMeal.error)}</p>
              <p className="text-muted-foreground">Your photo and note are still here — retry when ready.</p>
              <Button variant="secondary" size="sm" className="rounded-full" onClick={submit}>
                Retry
              </Button>
            </Card>
          )}
        </>
      )}

      {mode === "manual" && (
        <>
          <Card className="space-y-3 p-4">
            <p className="text-sm font-semibold">From your dishes</p>
            <Select value={dishId || "none"} onValueChange={(v) => setDishId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-12 w-full rounded-full border-0 bg-muted/60 px-4 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl p-1">
                <SelectItem className="rounded-lg px-3 py-2" value="none">
                  No dish — enter macros below
                </SelectItem>
                {(dishes.data ?? []).map((d) => (
                  <SelectItem className="rounded-lg px-3 py-2" key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dish && (
              <>
                <Input
                  className="h-12 rounded-full bg-muted/60 px-4 border-0 shadow-none"
                  type="number"
                  inputMode="decimal"
                  placeholder={`Grams (default ${dish.reference_serving_g ?? 100})`}
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(Number(dish.calories_per_100g) * scale)} cal · P{" "}
                  {Math.round(Number(dish.protein_g_per_100g ?? 0) * scale)}g · C{" "}
                  {Math.round(Number(dish.carbs_g_per_100g ?? 0) * scale)}g · F{" "}
                  {Math.round(Number(dish.fat_g_per_100g ?? 0) * scale)}g
                </p>
              </>
            )}
          </Card>

          {!dish && (
            <Card className="space-y-3 p-4">
              <Input
                className="h-12 rounded-full bg-muted/60 px-4 border-0 shadow-none"
                placeholder="What was it? (optional)"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
              />
              <Input
                className="h-12 rounded-full bg-muted/60 px-4 border-0 shadow-none"
                type="number"
                inputMode="numeric"
                placeholder="Calories"
                value={manualCalories}
                onChange={(e) => setManualCalories(e.target.value)}
              />
              <MacroInputs
                values={manualMacros}
                onChange={(key, value) => setManualMacros({ ...manualMacros, [key]: value })}
              />
            </Card>
          )}

          <Button
            className="h-12 w-full rounded-full"
            disabled={addManual.isPending || (!dish && !manualCalories)}
            onClick={submitManual}
          >
            {addManual.isPending ? "Logging…" : "Log meal"}
          </Button>
          {addManual.isError && (
            <p className="text-sm text-destructive">{errorMessage(addManual.error)}</p>
          )}
        </>
      )}
    </div>
  );
}
