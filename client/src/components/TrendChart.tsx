"use client";

import { useId } from "react";
import { motion } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Weight trend line over raw weigh-in dots, oldest → newest. */
export default function TrendChart({
  data,
}: {
  data: { logged_at: string; weight_kg: number; trend_weight_kg: number | null }[];
}) {
  const gradient = useId();
  if (data.length < 2) return null;
  const points = [...data].reverse();
  const trend = (p: (typeof points)[number]) => Number(p.trend_weight_kg ?? p.weight_kg);
  const values = points.flatMap((p) => [Number(p.weight_kg), trend(p)]);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const W = 320;
  const H = 120;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const trendPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(trend(p)).toFixed(1)}`)
    .join(" ");
  const areaPath = `${trendPath} L${W},${H} L0,${H} Z`;
  const last = points.length - 1;

  return (
    <svg viewBox={`-6 -8 ${W + 12} ${H + 14}`} className="w-full text-foreground" role="img" aria-label="Weight trend chart">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill={`url(#${gradient})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
      />
      {points.map((p, i) => (
        <motion.circle
          key={`${p.logged_at}-${i}`}
          cx={x(i)}
          cy={y(Number(p.weight_kg))}
          r="2.5"
          className="fill-muted-foreground/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 + (i / last) * 0.7 }}
        />
      ))}
      <motion.path
        d={trendPath}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-current"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: EASE }}
      />
      <motion.circle
        cx={x(last)}
        cy={y(trend(points[last]))}
        r="4.5"
        className="fill-current stroke-card"
        strokeWidth="2.5"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 16, stiffness: 300, delay: 0.85 }}
      />
    </svg>
  );
}
