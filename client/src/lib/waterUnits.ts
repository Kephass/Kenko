import { finiteNumber } from "./tracking";

export type WaterUnit = "ml" | "us-fl-oz";
const ML_PER_US_FL_OZ = 29.5735295625;
export function waterUnitLabel(unit: WaterUnit) { return unit === "ml" ? "ml" : "US fl oz"; }
export function waterToMl(amount: string | number, unit: WaterUnit) {
  return finiteNumber(finiteNumber(amount, "Water amount", true) * (unit === "ml" ? 1 : ML_PER_US_FL_OZ), "Water amount", true);
}
export function waterFromMl(ml: number, unit: WaterUnit) { return ml / (unit === "ml" ? 1 : ML_PER_US_FL_OZ); }
export function formatWater(ml: number, unit: WaterUnit) {
  return `${waterFromMl(ml, unit).toLocaleString(undefined, { maximumFractionDigits: unit === "ml" ? 1 : 2 })} ${waterUnitLabel(unit)}`;
}
export type WaterContainer = { name: string; ml: number };
export type WaterPreferences = { unit: WaterUnit; containers: WaterContainer[] };
export const DEFAULT_WATER_PREFERENCES: WaterPreferences = { unit: "ml", containers: [{ name: "Glass", ml: 250 }, { name: "Bottle", ml: 500 }, { name: "Large bottle", ml: 750 }] };
export function validateWaterPreferences(input: unknown): WaterPreferences {
  if (!input || typeof input !== "object") throw new Error("Invalid water preferences.");
  const value = input as Partial<WaterPreferences>;
  if ((value.unit !== "ml" && value.unit !== "us-fl-oz") || !Array.isArray(value.containers) || value.containers.length !== 3) throw new Error("Choose a valid unit and three containers.");
  const containers = value.containers.map(item => {
    if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 40 || typeof item.ml !== "number") throw new Error("Give each container a valid name and size.");
    return { name: item.name.trim(), ml: finiteNumber(item.ml, "Container", true) };
  });
  return { unit: value.unit, containers };
}
export function parseWaterPreferences(raw: string | null): WaterPreferences {
  try { return raw ? validateWaterPreferences(JSON.parse(raw)) : DEFAULT_WATER_PREFERENCES; }
  catch { return DEFAULT_WATER_PREFERENCES; }
}
