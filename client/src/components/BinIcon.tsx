"use client";

import { motion } from "motion/react";

/** How long the swallow takes: lid opens, content goes in, lid shuts. */
export const SWALLOW_S = 1;

/** Bin whose lid swings open while `open`, then drops shut with a gulp. */
export default function BinIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ overflow: "visible" }}
      animate={open ? { scale: [1, 1.25, 1.25, 0.9, 1] } : { scale: 1 }}
      transition={{ duration: SWALLOW_S, times: [0, 0.18, 0.72, 0.86, 1] }}
      aria-hidden
    >
      <path d="M5 7.5l1 12a2 2 0 0 0 2 1.8h8a2 2 0 0 0 2-1.8l1-12" />
      <path d="M10 11.5v5.5M14 11.5v5.5" />
      <motion.g
        style={{ originX: 0, originY: 1 }}
        animate={open ? { rotate: [0, -48, -48, 0], y: [0, -1.5, -1.5, 0] } : { rotate: 0, y: 0 }}
        transition={{ duration: SWALLOW_S, times: [0, 0.18, 0.72, 0.86], ease: "easeInOut" }}
      >
        <path d="M3.5 6.5h17" />
        <path d="M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7" />
      </motion.g>
    </motion.svg>
  );
}
