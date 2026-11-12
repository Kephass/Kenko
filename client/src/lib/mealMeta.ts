import { Cookie, Moon, Sun, Sunrise, Utensils, type LucideIcon } from "lucide-react";
import type { MealType } from "./tracking";

export const MEAL_META: Record<MealType, { label: string; Icon: LucideIcon }> = {
  breakfast: { label: "Breakfast", Icon: Sunrise },
  lunch: { label: "Lunch", Icon: Sun },
  dinner: { label: "Dinner", Icon: Moon },
  snack: { label: "Snack", Icon: Cookie },
  uncategorized: { label: "Other", Icon: Utensils },
};

/** The four categories offered when logging; "uncategorized" is legacy-only. */
export const MEAL_OPTIONS = (["breakfast", "lunch", "dinner", "snack"] as const).map((value) => ({ value, label: MEAL_META[value].label }));
