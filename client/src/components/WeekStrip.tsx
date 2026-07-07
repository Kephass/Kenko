"use client";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const R = 14.5;
const C = 2 * Math.PI * R;

export default function WeekStrip() {
  const now = new Date();
  // Cal AI window: 5 past days, today, tomorrow (faded)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (5 - i));
    return d;
  });
  const dayFraction = (now.getHours() + now.getMinutes() / 60) / 24;

  return (
    <div className="flex justify-between px-1">
      {days.map((d, i) => {
        const today = i === 5;
        const future = i === 6;
        return (
          <div key={d.toISOString()} className="flex flex-col items-center gap-1">
            {today ? (
              <span className="relative flex size-8 items-center justify-center text-xs font-semibold">
                <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90">
                  <circle cx="16" cy="16" r={R} fill="none" strokeWidth="2" className="stroke-foreground/15" />
                  <circle
                    cx="16"
                    cy="16"
                    r={R}
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - dayFraction)}
                    className="stroke-foreground"
                  />
                </svg>
                {LETTERS[d.getDay()]}
              </span>
            ) : (
              <span
                className={`flex size-8 items-center justify-center rounded-full border-2 border-dashed text-xs ${
                  future
                    ? "border-muted-foreground/20 text-muted-foreground/50"
                    : "border-muted-foreground/35 text-muted-foreground"
                }`}
              >
                {LETTERS[d.getDay()]}
              </span>
            )}
            <span
              className={`text-xs tabular-nums ${
                today ? "font-semibold" : future ? "text-muted-foreground/50" : "text-muted-foreground"
              }`}
            >
              {d.getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
