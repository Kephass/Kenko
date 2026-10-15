import { finiteNumber, logTimestamp } from "./tracking";
import { localDateISO } from "./utils";
import type { WaterWrite } from "./waterMutations";

export function quickWaterEntry(userId: string, day: string, ml: number): WaterWrite {
  if (!userId) throw new Error("Sign in to log water.");
  const now = new Date();
  return { operation: "add", row: {
    id: crypto.randomUUID(), user_id: userId, amount_ml: finiteNumber(ml, "Water amount", true),
    logged_at: day === localDateISO(now) ? now.toISOString() : logTimestamp(`${day}T12:00`),
  } };
}
