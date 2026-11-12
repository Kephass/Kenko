"use client";

import { useEffect, useState } from "react";
import type { CatalogFood } from "@/lib/catalog";

let cache: CatalogFood[] | null = null;

/** Lazily loads the bundled catalog so the logger opens instantly. */
export function useCatalogFoods() {
  const [foods, setFoods] = useState(cache);
  useEffect(() => {
    if (cache) return;
    let live = true;
    void import("@/data/catalogFoods").then((module) => {
      cache = module.foods;
      if (live) setFoods(module.foods);
    });
    return () => { live = false; };
  }, []);
  return foods;
}

export const CATALOG_CATEGORIES = ["Ghanaian", "Angolan", "Meals", "Fruits", "Vegetables", "Grains", "Beans & legumes", "Dairy & eggs", "Nuts & seeds", "Drinks", "Cocktails", "Mocktails"];
