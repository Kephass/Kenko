import foodsData from "./food-catalog.json";
import africanDishes from "./african-dishes.json";
import type { CatalogFood } from "@/lib/catalog";

export const foods: CatalogFood[] = [...africanDishes, ...foodsData];
