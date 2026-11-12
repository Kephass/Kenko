"use client";

import { motion } from "motion/react";

export const RING_SPRING = { type: "spring", damping: 28, stiffness: 90, mass: 1 } as const;

export default function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  className = "text-foreground",
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-foreground/8" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped) }}
          transition={RING_SPRING}
          className={`stroke-current ${className}`}
          style={{ opacity: clamped === 0 ? 0 : 1 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
