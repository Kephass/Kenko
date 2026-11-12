"use client";

import { MotionConfig, motion } from "motion/react";
import { Leaf } from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;
const LETTERS = "kenko".split("");
/** How long the opening scene holds before the app is revealed. */
export const SPLASH_MS = 1700;

function Ring({ r, stroke, delay, className }: { r: number; stroke: number; delay: number; className: string }) {
  return (
    <g className={className}>
      <circle cx="60" cy="60" r={r} fill="none" strokeWidth={stroke} className="stroke-current opacity-10" />
      <motion.circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        className="stroke-current"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ pathLength: { duration: 1, ease: EASE, delay }, opacity: { duration: 0.01, delay } }}
      />
    </g>
  );
}

/** Opening scene: the diary's twin rings close around the mark, then the name rises. */
export default function Splash() {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        role="status"
        aria-label="Opening Kenko"
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-background"
        exit={{ opacity: 0, scale: 1.06 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(120%_55%_at_50%_-10%,oklch(0.905_0.012_265/0.85),transparent_70%)]" aria-hidden />
        <div className="relative size-30">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <Ring r={52} stroke={9} delay={0.1} className="text-foreground" />
            <Ring r={39} stroke={9} delay={0.28} className="text-carbs" />
          </svg>
          <motion.span
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 0, rotate: -40, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 220, delay: 0.55 }}
          >
            <Leaf className="size-8 text-fiber" strokeWidth={2.2} />
          </motion.span>
        </div>
        <div className="relative text-center">
          <p className="flex justify-center overflow-hidden text-4xl font-extrabold tracking-tight" aria-hidden>
            {LETTERS.map((letter, index) => (
              <motion.span
                key={index}
                className="inline-block"
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.6 + index * 0.05 }}
              >
                {letter}
              </motion.span>
            ))}
          </p>
          <motion.p
            className="mt-1 text-sm font-medium tracking-[0.4em] text-muted-foreground"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 1 }}
            aria-hidden
          >
            健康
          </motion.p>
        </div>
      </motion.div>
    </MotionConfig>
  );
}
