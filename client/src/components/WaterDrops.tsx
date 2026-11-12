"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";

type Point = { x: number; y: number };
type Drop = { delay: number; lift: number; land: number; size: number };
type Pour = { id: number; from: Point; to: Point; drops: Drop[] };

/** When the drops land, so fills can wait for the water to arrive. */
export const POUR_LANDS_S = 0.6;

let pours: Pour[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const center = (target: Element | Point): Point => {
  if (!(target instanceof Element)) return target;
  const rect = target.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

/** Droplets leap from one element and rain onto another; `spread` widens the landing strip (px). */
export function pourWater(from: Element, to: Element | Point, { amount = 10, spread = 0 }: { amount?: number; spread?: number } = {}) {
  const drops = Array.from({ length: amount }, (_, index) => ({
    delay: index * 0.05,
    lift: 16 + Math.random() * 22,
    land: spread ? (index / (amount - 1)) * spread + (Math.random() - 0.5) * 8 : (Math.random() - 0.5) * 10,
    size: 6 + Math.random() * 7,
  }));
  const pour = { id: nextId++, from: center(from), to: center(to), drops };
  pours = [...pours, pour];
  emit();
  // The target swells as the water lands.
  if (to instanceof Element) to.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { delay: POUR_LANDS_S * 1000, duration: 450, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
  setTimeout(() => { pours = pours.filter((item) => item.id !== pour.id); emit(); }, 2000);
}

const NONE: Pour[] = [];

/** Mounted once; draws every pour above the page in viewport coordinates. */
export default function WaterDrops() {
  const active = useSyncExternalStore(subscribe, () => pours, () => NONE);
  if (!active.length) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {active.map((pour) => (
        <div key={pour.id}>
          {pour.drops.map((drop, index) => {
            const endX = pour.to.x + drop.land;
            const midX = (pour.from.x + endX) / 2;
            const midY = Math.min(pour.from.y, pour.to.y) - drop.lift;
            return (
              <motion.span
                key={index}
                className="absolute top-0 left-0 rounded-[50%_50%_50%_0] bg-linear-to-br from-[oklch(0.86_0.08_225)] to-water shadow-[inset_-1px_-1px_2px_oklch(1_0_0/0.5),0_2px_6px_oklch(0.72_0.11_230/0.45)]"
                style={{ width: drop.size, height: drop.size, marginLeft: -drop.size / 2, marginTop: -drop.size / 2 }}
                initial={{ x: pour.from.x, y: pour.from.y, scale: 0, opacity: 0, rotate: -45 }}
                animate={{
                  x: [pour.from.x, midX, endX],
                  y: [pour.from.y, midY, pour.to.y],
                  scale: [0, 1.15, 0.7],
                  opacity: [0, 1, 1, 0],
                  rotate: [-45, -45, 135],
                }}
                transition={{
                  duration: POUR_LANDS_S,
                  delay: drop.delay,
                  x: { duration: POUR_LANDS_S, delay: drop.delay, ease: "linear" },
                  y: { duration: POUR_LANDS_S, delay: drop.delay, ease: ["easeOut", "easeIn"] },
                  opacity: { duration: POUR_LANDS_S, delay: drop.delay, times: [0, 0.15, 0.9, 1] },
                }}
              />
            );
          })}
          {pour.drops.filter((_, index) => index % 3 === 0).map((drop, index) => (
            <motion.span
              key={`ripple-${index}`}
              className="absolute top-0 left-0 -mt-2 -ml-2 size-4 rounded-full border-2 border-water"
              initial={{ x: pour.to.x + drop.land, y: pour.to.y, scale: 0, opacity: 0 }}
              animate={{ scale: [0, 2.2], opacity: [0.7, 0] }}
              transition={{ duration: 0.6, delay: POUR_LANDS_S + drop.delay, ease: "easeOut" }}
            />
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
}
