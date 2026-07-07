"use client";

import ProgressRing from "@/components/ProgressRing";
import { addDays, localDateISO } from "@/lib/utils";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const PAST_DAYS = 5;

/** The window the strip renders: 5 past days, today, tomorrow. Consumers fetching
 *  data for the rings should derive their date range from this same list. */
export function weekStripDays(now = new Date()) {
  return Array.from({ length: PAST_DAYS + 2 }, (_, i) => addDays(now, i - PAST_DAYS));
}

/** Cal AI-style week strip. Past days and today are tappable; each ring shows
 *  that day's calories vs. the daily target. */
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
    <div className="flex justify-between px-1">
      {days.map((d, i) => {
        const day = localDateISO(d);
        const future = i === days.length - 1;
        const isSelected = day === selected;
        return (
          <button
            key={day}
            type="button"
            disabled={future}
            onClick={() => onSelect(day)}
            className="flex flex-col items-center gap-1"
          >
            {future ? (
              <span className="flex size-8 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/20 text-xs text-muted-foreground/50">
                {LETTERS[d.getDay()]}
              </span>
            ) : (
              <ProgressRing
                value={ratios[day] ?? 0}
                size={32}
                stroke={2}
                className={isSelected ? "text-foreground" : "text-foreground/45"}
              >
                {isSelected && <span className="absolute inset-1 rounded-full bg-foreground" />}
                <span
                  className={`relative text-xs ${
                    isSelected ? "font-semibold text-background" : "text-muted-foreground"
                  }`}
                >
                  {LETTERS[d.getDay()]}
                </span>
              </ProgressRing>
            )}
            <span
              className={`text-xs tabular-nums ${
                isSelected
                  ? "font-semibold"
                  : future
                    ? "text-muted-foreground/50"
                    : "text-muted-foreground"
              }`}
            >
              {d.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
