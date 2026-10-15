"use client";

import { useState, useSyncExternalStore } from "react";
import { catalogDraftKey, activeCatalogDraft, type CatalogDraft } from "@/lib/catalogDraft";
import type { BasketPortion } from "@/lib/catalog";
import { initialLogTime, mealTypeForTime, type MealType } from "@/lib/tracking";

const EVENT = "kenko-catalog-draft";
// When storage is unavailable, retain this page's work and show an explicit warning.
const memory = new Map<string, string | null>();
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(EVENT, callback); };
}
export function useCatalogDraft(userId: string, day: string) {
  const key = catalogDraftKey(userId, day);
  const [initialWhen] = useState(() => initialLogTime(day));
  const [error, setError] = useState("");
  const read = () => {
    if (memory.has(key)) return memory.get(key) ?? null;
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const empty = (): CatalogDraft => ({ version: 1, userId, day, items: [], when: initialWhen, mealType: mealTypeForTime(new Date(initialWhen)) });
  const [transient, setTransient] = useState(empty);
  const draft = activeCatalogDraft(raw, userId, day) ?? transient;
  function update(change: (current: CatalogDraft) => CatalogDraft) {
    const next = change(activeCatalogDraft(read(), userId, day) ?? transient);
    const serialized = next.items.length ? JSON.stringify(next) : null;
    // Empty form choices survive this visit only; they are not a resumable meal.
    setTransient({ ...next, items: [] });
    try {
      if (!userId) throw new Error("No account");
      if (serialized) localStorage.setItem(key, serialized); else localStorage.removeItem(key);
      memory.delete(key); setError("");
    } catch {
      memory.set(key, serialized);
      setError("Your browser could not save this draft. Keep this page open until you log it; changes may be lost on reload.");
    }
    window.dispatchEvent(new Event(EVENT));
  }
  return {
    ...draft, error,
    setItems: (value: BasketPortion[] | ((items: BasketPortion[]) => BasketPortion[])) => update(current => ({ ...current, items: typeof value === "function" ? value(current.items) : value })),
    setWhen: (when: string) => update(current => ({ ...current, when })),
    setMealType: (mealType: MealType) => update(current => ({ ...current, mealType })),
    discard: () => update(current => ({ ...current, items: [] })),
  };
}
