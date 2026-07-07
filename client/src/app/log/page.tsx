"use client";

import { useState } from "react";
import { useConfirmMealLog, useDiscardMealLog, useLogMeal } from "@/hooks/useMealLogs";

/**
 * Meal logging: camera/text -> POST log-meal -> show the draft for
 * confirmation. The edge function inserts the row (confirmed=false); the
 * confirm button here is a plain UPDATE on that same row, not a re-submit.
 *
 * On failure the captured photo/text stays in local state with an explicit
 * retry - never auto-retried, since a lost response after a successful AI
 * call would create a duplicate log.
 */
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
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Confirm this meal?</h1>
        <div className="rounded-lg border p-4 text-sm dark:border-neutral-700">
          <p className="text-2xl tabular-nums">{Math.round(Number(draft.calories))} kcal</p>
          <p className="mt-1 text-neutral-500 tabular-nums">
            P {Number(draft.protein_g ?? 0)} · C {Number(draft.carbs_g ?? 0)} · F{" "}
            {Number(draft.fat_g ?? 0)} g
          </p>
          {draft.match_confidence && (
            <p className="mt-1 text-xs text-neutral-500">
              match confidence {(Number(draft.match_confidence) * 100).toFixed(0)}%
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="flex-1 rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
            disabled={confirm.isPending}
            onClick={() => confirm.mutate({ id: draft.id }, { onSuccess: reset })}
          >
            Confirm
          </button>
          <button
            className="flex-1 rounded border px-4 py-2 dark:border-neutral-700"
            disabled={discard.isPending}
            onClick={() => discard.mutate(draft.id, { onSuccess: reset })}
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Log a meal</h1>

      <label className="block rounded-lg border-2 border-dashed p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        {imageBase64 ? "Photo captured ✓ (tap to retake)" : "Take a photo of your meal"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>

      <textarea
        className="w-full rounded border px-3 py-2 text-sm dark:bg-neutral-900 dark:border-neutral-700"
        rows={2}
        placeholder='Optional note, e.g. "one and a half plates" (text-only parsing not implemented yet)'
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button
        className="w-full rounded bg-green-700 px-4 py-3 text-white disabled:opacity-50"
        disabled={logMeal.isPending || (!imageBase64 && !text)}
        onClick={submit}
      >
        {logMeal.isPending ? "Analyzing…" : "Analyze meal"}
      </button>

      {logMeal.isError && (
        <div className="rounded border border-red-300 p-3 text-sm text-red-700 dark:border-red-900 dark:text-red-400">
          <p>{(logMeal.error as Error).message}</p>
          <p className="mt-1 text-neutral-500">
            Your photo and note are still here - fix the issue and retry.
          </p>
          <button className="mt-2 underline" onClick={submit}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
