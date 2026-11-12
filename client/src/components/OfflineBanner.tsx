"use client";

import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { CloudOff } from "lucide-react";

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange);

export function useOnline() {
  return useSyncExternalStore(subscribe, () => onlineManager.isOnline(), () => true);
}

/** Floating pill shown while offline; mutations queue and sync on reconnect. */
export default function OfflineBanner() {
  const online = useOnline();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {!online && (
          <motion.span
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 380 }}
            className="flex h-9 items-center gap-2 rounded-full bg-foreground/95 pr-4 pl-1.5 text-xs font-semibold text-background shadow-float backdrop-blur"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-background/15">
              <CloudOff className="size-3.5" />
            </span>
            Offline · logs sync when you&apos;re back
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
