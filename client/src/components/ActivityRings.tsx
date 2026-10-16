"use client";

export type Ring = { value: number; colorClass: string; label?: string };

// Concentric progress rings in the Apple Fitness style: each ring is a faint
// track plus a rounded-cap arc, nested from outer (index 0) to inner.
export default function ActivityRings({
  rings,
  size = 132,
  stroke = 14,
  gap = 5,
  children,
}: {
  rings: Ring[];
  size?: number;
  stroke?: number;
  gap?: number;
  children?: React.ReactNode;
}) {
  const center = size / 2;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={rings.map((r) => r.label).filter(Boolean).join(", ")}>
        {rings.map((ring, i) => {
          const r = center - stroke / 2 - i * (stroke + gap);
          if (r <= 0) return null;
          const circumference = 2 * Math.PI * r;
          const clamped = Math.max(0, Math.min(1, ring.value));
          return (
            <g key={i} className={ring.colorClass}>
              <circle cx={center} cy={center} r={r} fill="none" strokeWidth={stroke} className="stroke-current opacity-15" />
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - clamped)}
                className="stroke-current transition-[stroke-dashoffset] duration-500"
              />
            </g>
          );
        })}
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
