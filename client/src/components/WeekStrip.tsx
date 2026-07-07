"use client";

import { localDateISO } from "@/lib/utils";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const R = 14.5;
const C = 2 * Math.PI * R;

/** Cal AI-style week strip: 5 past days, today, tomorrow (faded). Past days and
 *  today are tappable; each ring shows that day's calories vs. the daily target. */
export default function WeekStrip({
  selected,
  onSelect,
  ratios,
}: {
  selected: string;
  onSelect: (day: string) => void;
  ratios: Record<string, number>;
}) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (5 - i));
    return d;
  });

  return (
    <div className="flex justify-between px-1">
      {days.map((d, i) => {
        const day = localDateISO(d);
        const future = i === 6;
        const isSelected = day === selected;
        const ratio = Math.min(1, ratios[day] ?? 0);
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
              <span
                className={`relative flex size-8 items-center justify-center text-xs ${
                  isSelected ? "font-semibold" : "text-muted-foreground"
                }`}
              >
                <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90">
                  <circle cx="16" cy="16" r={R} fill="none" strokeWidth="2" className="stroke-foreground/15" />
                  {ratio > 0 && (
                    <circle
                      cx="16"
                      cy="16"
                      r={R}
                      fill="none"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={C}
                      strokeDashoffset={C * (1 - ratio)}
                      className={isSelected ? "stroke-foreground" : "stroke-foreground/45"}
                    />
                  )}
                </svg>
                {isSelected && <span className="absolute inset-1 rounded-full bg-foreground" />}
                <span className={`relative ${isSelected ? "text-background" : ""}`}>
                  {LETTERS[d.getDay()]}
                </span>
              </span>
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
