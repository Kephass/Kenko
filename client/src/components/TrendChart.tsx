"use client";

/** Weight trend line over raw weigh-in dots, oldest → newest. */
export default function TrendChart({
  data,
}: {
  data: { logged_at: string; weight_kg: number; trend_weight_kg: number | null }[];
}) {
  if (data.length < 2) return null;
  const points = [...data].reverse();
  const values = points.flatMap((p) => [Number(p.weight_kg), Number(p.trend_weight_kg ?? p.weight_kg)]);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const W = 320;
  const H = 120;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const trendPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(Number(p.trend_weight_kg ?? p.weight_kg)).toFixed(1)}`)
    .join(" ");
  const areaPath = `${trendPath} L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`-4 -6 ${W + 8} ${H + 12}`} className="w-full">
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#trend-fill)" className="text-foreground" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(Number(p.weight_kg))} r="2.5" className="fill-muted-foreground/40" />
      ))}
      <path d={trendPath} fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-foreground" />
    </svg>
  );
}
