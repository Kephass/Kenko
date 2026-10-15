"use client";

import { useMutationState, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/utils";

export default function SyncStatus() {
  const qc = useQueryClient();
  const states = useMutationState({
    filters: { predicate: (m) => !!m.options.mutationKey },
    select: (m) => ({ status: m.state.status, paused: m.state.isPaused, error: m.state.error }),
  });
  const failed = states.filter((s) => s.status === "error");
  const pending = states.filter((s) => s.paused);
  if (!failed.length && !pending.length) return null;
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-3 text-sm" role="status">
      {pending.length > 0 && <p>{pending.length} {pending.length === 1 ? "entry waiting" : "entries waiting"} to sync.</p>}
      {failed.length > 0 && <div className="space-y-2 rounded-xl bg-destructive/10 p-3">
        <p>{failed.length} {failed.length === 1 ? "entry could" : "entries could"} not sync. {errorMessage(failed[0].error)}</p>
        <Button size="sm" variant="secondary" onClick={() => {
          for (const mutation of qc.getMutationCache().findAll({ status: "error", predicate: (m) => !!m.options.mutationKey })) {
            void mutation.execute(mutation.state.variables).catch(() => { /* Error stays visible for retry. */ });
          }
        }}>Retry sync</Button>
      </div>}
    </div>
  );
}
