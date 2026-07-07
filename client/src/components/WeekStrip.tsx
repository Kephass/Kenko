"use client";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export default function WeekStrip() {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  return (
    <div className="flex justify-between px-1">
      {days.map((d, i) => {
        const today = i === 6;
        return (
          <div key={d.toISOString()} className="flex flex-col items-center gap-1">
            <span
              className={
                today
                  ? "flex size-8 items-center justify-center rounded-full border-2 border-foreground text-xs font-semibold"
                  : "flex size-8 items-center justify-center rounded-full border-2 border-dashed border-border text-xs text-muted-foreground"
              }
            >
              {LETTERS[d.getDay()]}
            </span>
            <span className={`text-xs tabular-nums ${today ? "font-semibold" : "text-muted-foreground"}`}>
              {d.getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
