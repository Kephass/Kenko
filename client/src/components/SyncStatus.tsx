"use client";

import { useMutationState, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { CloudUpload, TriangleAlert } from "lucide-react";
import { useOnline } from "@/components/OfflineBanner";
import { errorMessage } from "@/lib/utils";

const pop = {
  initial: { opacity: 0, y: -16, scale: 0.92 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.96 },
  transition: { type: "spring", damping: 26, stiffness: 380 },
} as const;

/** Floating pills for queued and failed writes; sits below the offline pill. */
export default function SyncStatus() {
  const qc = useQueryClient();
  const online = useOnline();
  const states = useMutationState({
    filters: { predicate: (m) => !!m.options.mutationKey },
    select: (m) => ({ status: m.state.status, paused: m.state.isPaused, error: m.state.error }),
  });
  const failed = states.filter((s) => s.status === "error");
  const pending = states.filter((s) => s.paused);
  function retry() {
    for (const mutation of qc.getMutationCache().findAll({ status: "error", predicate: (m) => !!m.options.mutationKey })) {
      void mutation.execute(mutation.state.variables).catch(() => { /* Error stays visible for retry. */ });
    }
  }
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4 transition-[top] duration-300 ${online ? "top-[max(0.75rem,env(safe-area-inset-top))]" : "top-[calc(max(0.75rem,env(safe-area-inset-top))+2.75rem)]"}`}
      role="status"
    >
      <AnimatePresence>
        {pending.length > 0 && (
          <motion.p key="pending" {...pop} className="flex h-9 items-center gap-2 rounded-full bg-card/90 pr-4 pl-1.5 text-xs font-semibold shadow-float ring-1 ring-black/[0.05] backdrop-blur-xl">
            <span className="flex size-6 items-center justify-center rounded-full bg-muted">
              <CloudUpload className="size-3.5" />
            </span>
            {pending.length} {pending.length === 1 ? "entry waiting" : "entries waiting"} to sync
          </motion.p>
        )}
        {failed.length > 0 && (
          <motion.div key="failed" {...pop} className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full bg-foreground/95 py-1.5 pr-1.5 pl-1.5 text-background shadow-float backdrop-blur">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive text-white">
              <TriangleAlert className="size-3.5" />
            </span>
            <p className="min-w-0 text-xs leading-tight">
              <span className="block font-semibold">{failed.length} {failed.length === 1 ? "entry could" : "entries could"} not sync</span>
              <span className="block truncate text-background/70">{errorMessage(failed[0].error)}</span>
            </p>
            <button type="button" className="press h-8 shrink-0 rounded-full bg-background px-3.5 text-xs font-semibold text-foreground" onClick={retry}>
              Retry sync
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
