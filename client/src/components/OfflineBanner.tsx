"use client";

import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";
import { CloudOff } from "lucide-react";

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange);

/** Floating pill shown while offline; mutations queue and sync on reconnect. */
export default function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => onlineManager.isOnline(),
    () => true,
  );

  if (online) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center">
      <span className="flex items-center gap-1.5 rounded-full bg-foreground/90 px-3.5 py-1.5 text-xs font-semibold text-background shadow-soft">
        <CloudOff className="size-3.5" />
        Offline — logs will sync when you&apos;re back
      </span>
    </div>
  );
}
