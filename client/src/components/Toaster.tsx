"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";

type Toast = { id: number; message: string; action?: { label: string; onClick: () => void } };

let current: Toast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Show a short confirmation, optionally with one action such as Undo. */
export function toast(message: string, action?: Toast["action"]) {
  current = { id: nextId++, message, action };
  emit();
  if (typeof navigator !== "undefined") navigator.vibrate?.(8);
}
function dismiss(id: number) {
  if (current?.id !== id) return;
  current = null;
  emit();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export default function Toaster() {
  const active = useSyncExternalStore(subscribe, () => current, () => null);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => dismiss(active.id), active.action ? 5500 : 2800);
    return () => clearTimeout(timer);
  }, [active]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {active && (
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 380 }}
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-foreground/95 py-2 pr-2 pl-3 text-sm font-medium text-background shadow-float backdrop-blur"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background/15">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            <span className="truncate pr-2">{active.message}</span>
            {active.action && (
              <button
                type="button"
                className="press shrink-0 rounded-full bg-background px-3.5 py-1.5 text-sm font-semibold text-foreground"
                onClick={() => { active.action!.onClick(); dismiss(active.id); }}
              >
                {active.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
