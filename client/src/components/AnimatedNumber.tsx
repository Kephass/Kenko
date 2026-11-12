"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

const format = (value: number, decimals: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Counts smoothly from the previous value to the new one. */
export default function AnimatedNumber({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const reduce = useReducedMotion();
  // Text is driven imperatively after mount, so React only renders the start.
  const [initial] = useState(() => format(0, decimals));
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    const target = Number.isFinite(value) ? value : 0;
    if (reduce) {
      shown.current = target;
      element.textContent = format(target, decimals);
      return;
    }
    const controls = animate(shown.current, target, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        shown.current = latest;
        element.textContent = format(latest, decimals);
      },
    });
    return () => controls.stop();
  }, [value, decimals, reduce]);
  return <span ref={node} className={className}>{initial}</span>;
}
