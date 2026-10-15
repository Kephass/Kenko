import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Tables } from "./types";
import { finiteNumber } from "./tracking";
import { localDateISO } from "./utils";

export const WATER_MUTATION_KEY = ["water_logs", "write"] as const;
export type WaterWrite = {
  operation: "add" | "update" | "delete";
  row: Tables<"water_logs">;
};

type WaterRow = Tables<"water_logs">;
type WaterContext = { snapshots?: { key: readonly unknown[]; previous?: WaterRow }[]; key?: readonly unknown[]; previous?: WaterRow };
function sortedWater(rows: WaterRow[]) { return rows.sort((a, b) => b.logged_at.localeCompare(a.logged_at)); }

export function registerWaterMutationDefaults(qc: QueryClient) {
  qc.setMutationDefaults(WATER_MUTATION_KEY, {
    // Keep edits/deletes behind an earlier queued add across reconnects.
    scope: { id: "water-writes" },
    mutationFn: async ({ operation, row }: WaterWrite) => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id !== row.user_id) throw new Error("Sign in to the account that created this entry to sync it.");
      if (operation !== "delete") {
        finiteNumber(row.amount_ml, "Water amount", true);
        if (!Number.isFinite(new Date(row.logged_at).getTime())) throw new Error("Water date is invalid.");
      }
      const result = operation === "delete"
        ? await supabase.from("water_logs").delete().eq("id", row.id).eq("user_id", row.user_id)
        : operation === "update"
          ? await supabase.from("water_logs").update({ amount_ml: row.amount_ml, logged_at: row.logged_at }).eq("id", row.id).eq("user_id", row.user_id).select("id").single()
          : await supabase.from("water_logs").upsert(row, { onConflict: "id", ignoreDuplicates: true });
      if (result.error) throw result.error;
    },
    onMutate: async ({ operation, row }: WaterWrite): Promise<WaterContext> => {
      if (!Number.isFinite(new Date(row.logged_at).getTime())) throw new Error("Water date is invalid.");
      await qc.cancelQueries({ queryKey: ["water_logs"] });
      const day = localDateISO(new Date(row.logged_at));
      const entries = qc.getQueriesData<WaterRow[]>({ queryKey: ["water_logs", "day"] });
      if (operation !== "delete" && !entries.some(([key]) => key[2] === day)) entries.push([["water_logs", "day", day], undefined]);
      const snapshots = entries.map(([key, rows]) => ({ key, previous: rows?.find(w => w.id === row.id) }));
      for (const [key, rows = []] of entries) {
        const rest = rows.filter(w => w.id !== row.id);
        qc.setQueryData(key, operation !== "delete" && key[2] === day ? sortedWater([row, ...rest]) : rest);
      }
      return { snapshots };
    },
    onError: (_error, { row }, context) => {
      if (!context) return;
      // Older persisted queues used a single-day rollback context.
      const snapshots = context.snapshots ?? (context.key ? [{ key: context.key, previous: context.previous }] : []);
      for (const { key, previous } of snapshots) {
        qc.setQueryData<WaterRow[]>(key, (old = []) => {
          const rest = old.filter(w => w.id !== row.id);
          return previous ? sortedWater([previous, ...rest]) : rest;
        });
      }
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: WATER_MUTATION_KEY }) === 1) {
        qc.invalidateQueries({ queryKey: ["water_logs"] });
        qc.invalidateQueries({ queryKey: ["water_summary"] });
      }
    },
  });
}
