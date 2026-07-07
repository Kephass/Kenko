"use client";

import { useState } from "react";
import { Camera, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MACROS } from "@/lib/macros";
import { useConfirmMealLog, useDiscardMealLog, useLogMeal } from "@/hooks/useMealLogs";

// Camera/text -> POST log-meal -> confirm screen; confirming is an UPDATE on
// the draft row, and failed captures stay in state for an explicit retry.
export default function LogPage() {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [text, setText] = useState("");
  const logMeal = useLogMeal();
  const confirm = useConfirmMealLog();
  const discard = useDiscardMealLog();

  const draft = logMeal.data;

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
    logMeal.mutate({
      imageBase64: imageBase64 ?? undefined,
      textInput: text || undefined,
    });
  }

  function reset() {
    setImageBase64(null);
    setText("");
    logMeal.reset();
  }

  if (draft && !confirm.isSuccess) {
    return (
      <div className="space-y-5">
        <h1 className="pt-1 text-xl font-extrabold tracking-tight">Confirm this meal?</h1>

        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              <Flame className="size-5" />
            </span>
            <p className="text-4xl font-extrabold tabular-nums">
              {Math.round(Number(draft.calories))}
              <span className="ml-1 text-base font-semibold text-muted-foreground">cal</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {MACROS.map(({ key, label, colorClass, Icon }) => (
              <div key={key} className="rounded-2xl bg-muted/60 p-3 text-center">
                <Icon className={`mx-auto size-4 ${colorClass}`} />
                <p className="mt-1 text-sm font-bold tabular-nums">
                  {Math.round(Number(draft[`${key}_g`] ?? 0))}g
                </p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          {draft.match_confidence && (
            <p className="text-xs text-muted-foreground">
              Match confidence {(Number(draft.match_confidence) * 100).toFixed(0)}%
            </p>
          )}
        </Card>

        <div className="flex gap-2">
          <Button
            className="h-12 flex-1 rounded-full"
            disabled={confirm.isPending}
            onClick={() => confirm.mutate({ id: draft.id }, { onSuccess: reset })}
          >
            Confirm
          </Button>
          <Button
            variant="secondary"
            className="h-12 flex-1 rounded-full bg-card shadow-sm"
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
      <h1 className="pt-1 text-xl font-extrabold tracking-tight">Log a meal</h1>

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
        className="w-full rounded-3xl border-0 bg-card p-4 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
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
          <p className="font-medium text-destructive">{(logMeal.error as Error).message}</p>
          <p className="text-muted-foreground">Your photo and note are still here — retry when ready.</p>
          <Button variant="secondary" size="sm" className="rounded-full" onClick={submit}>
            Retry
          </Button>
        </Card>
      )}
    </div>
  );
}
