import type { BasketPortion } from "./catalog";
import { MEAL_TYPES, type MealType } from "./tracking";

export type CatalogDraft = { version: 1; userId: string; day: string; items: BasketPortion[]; when: string; mealType: MealType };
export const catalogDraftKey = (userId: string, day: string) => `kenko-catalog-draft:v1:${userId}:${day}`;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const bounded = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const nutrient = (value: unknown) => value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);

/** Drafts may contain unfinished weight/date fields; nutrition snapshots must remain valid. */
export function parseCatalogDraft(raw: string | null, userId: string, day: string): CatalogDraft | null {
  if (!raw || !userId || raw.length > 500_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || value.version !== 1 || value.userId !== userId || value.day !== day || !bounded(value.when, 32) || !MEAL_TYPES.includes(value.mealType as MealType) || !Array.isArray(value.items) || value.items.length > 100) return null;
    const ids = new Set<string>();
    for (const item of value.items) {
      if (!object(item) || !bounded(item.id, 100) || !item.id || ids.has(item.id)) return null;
      ids.add(item.id);
      if ("quick" in item) {
        if (!object(item.quick) || !bounded(item.quick.name, 500) || !item.quick.name.trim() || !bounded(item.portions, 40) || typeof item.quick.calories !== "number" || !nutrient(item.quick.calories)) return null;
        for (const field of ["protein_g", "carbs_g", "fat_g", "fiber_g"]) if (!nutrient(item.quick[field])) return null;
        continue;
      }
      if (!bounded(item.grams, 40) || !object(item.food)) return null;
      const food = item.food;
      if (!bounded(food.id, 100) || !bounded(food.name, 500) || !food.name.trim() || !bounded(food.category, 100) || typeof food.estimated !== "boolean" || !object(food.nutrition) || !Array.isArray(food.portions) || food.portions.length > 100) return null;
      if (typeof food.nutrition.calories !== "number" || !nutrient(food.nutrition.calories)) return null;
      for (const field of ["protein", "carbs", "fat", "fiber"]) if (!nutrient(food.nutrition[field])) return null;
      if (food.recipe !== undefined && !bounded(food.recipe, 10_000)) return null;
      if (food.portions.some(portion => !object(portion) || !bounded(portion.label, 300) || typeof portion.grams !== "number" || !Number.isFinite(portion.grams) || portion.grams <= 0)) return null;
    }
    return value as CatalogDraft;
  } catch { return null; }
}

/** Old empty envelopes are not active drafts and must not restore stale meal times. */
export function activeCatalogDraft(raw: string | null, userId: string, day: string) {
  const draft = parseCatalogDraft(raw, userId, day);
  return draft?.items.length ? draft : null;
}

/** A completed write must not discard edits made after its snapshot was submitted. */
export function remainingBasketAfterLog(current: BasketPortion[], submitted: BasketPortion[]) {
  const snapshots = new Map(submitted.map(item => [item.id, JSON.stringify(item)]));
  return current.filter(item => snapshots.get(item.id) !== JSON.stringify(item));
}
