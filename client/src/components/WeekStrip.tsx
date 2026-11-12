"use client";

import { motion } from "motion/react";
import ProgressRing from "@/components/ProgressRing";
import { addDays, localDateISO } from "@/lib/utils";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const PAST_DAYS = 5;

/** The window the strip renders: 5 past days, today, tomorrow. Consumers fetching
 *  data for the rings should derive their date range from this same list. */
export function weekStripDays(now = new Date()) {
  return Array.from({ length: PAST_DAYS + 2 }, (_, i) => addDays(now, i - PAST_DAYS));
}

/** Week strip: each ring shows that day's calories against its target. */
export default function WeekStrip({
  selected,
  onSelect,
  ratios,
}: {
  selected: string;
  onSelect: (day: string) => void;
  ratios: Record<string, number>;
}) {
  const days = weekStripDays();

  return (
    <div className="flex justify-between">
      {days.map((d, i) => {
        const day = localDateISO(d);
        const future = i === days.length - 1;
        const isSelected = day === selected;
        const ratio = ratios[day] ?? 0;
        return (
          <button
            key={day}
            type="button"
            disabled={future}
            aria-pressed={isSelected}
            aria-label={d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
            onClick={() => onSelect(day)}
            className="press flex flex-col items-center gap-1.5"
          >
            <span className={`text-[11px] font-semibold ${isSelected ? "text-foreground" : future ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
              {LETTERS[d.getDay()]}
            </span>
            <span className="relative flex size-10 items-center justify-center">
              {isSelected && (
                <motion.span
                  layoutId="week-selected"
                  className="absolute inset-0 rounded-full bg-linear-to-b from-[oklch(0.32_0_0)] to-[oklch(0.16_0_0)] shadow-[inset_0_1px_0_oklch(1_0_0/0.12),0_4px_12px_oklch(0_0_0/0.2)]"
                  transition={{ type: "spring", damping: 28, stiffness: 380 }}
                />
              )}
              {future ? (
                <span className="absolute inset-0.5 rounded-full border-[1.5px] border-dashed border-muted-foreground/25" />
              ) : !isSelected && (
                <span className="absolute inset-0">
                  <ProgressRing value={ratio} size={40} stroke={2.5} className={ratio > 1 ? "text-destructive" : "text-foreground"} />
                </span>
              )}
              <span className={`relative text-sm font-bold tabular-nums transition-colors duration-200 ${isSelected ? "text-background" : future ? "text-muted-foreground/40" : "text-foreground"}`}>
                {d.getDate()}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
