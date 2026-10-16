// Weekly insights and achievements — pure derivations over the daily series the
// Progress page already loads, so no extra queries. Weekly numbers use the last
// 7 days; achievements use the current streak and the 30-day window.
export type DaySeries = {
  day: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  mealCount: number;
  goal: number | null;
};

const round = (n: number) => Math.round(n);
const macroCalories = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9;

export type WeeklyInsights = {
  loggedDays: number;
  avgCalories: number;
  avgGoal: number | null;
  vsTarget: number | null; // avgCalories - avgGoal, when a goal exists
  macroSplit: { protein: number; carbs: number; fat: number } | null; // % of macro calories
  avgFiber: number;
  totalWaterMl: number;
  avgWaterMl: number;
  callouts: string[];
};

/** Summarise the last 7 days (through `today`) from the 30-day series. */
export function weeklyInsights(series: DaySeries[], waterByDay: Record<string, number>, today: string): WeeklyInsights {
  const start = isoDaysAgo(today, 6);
  const week = series.filter((d) => d.day >= start && d.day <= today);
  const logged = week.filter((d) => d.mealCount > 0);
  const loggedDays = logged.length;

  const avgCalories = loggedDays ? round(logged.reduce((s, d) => s + d.calories, 0) / loggedDays) : 0;
  const goals = week.map((d) => d.goal).filter((g): g is number => g != null && g > 0);
  const avgGoal = goals.length ? round(goals.reduce((s, g) => s + g, 0) / goals.length) : null;
  const vsTarget = avgGoal != null && loggedDays ? avgCalories - avgGoal : null;

  const totals = logged.reduce((s, d) => ({ protein: s.protein + d.protein, carbs: s.carbs + d.carbs, fat: s.fat + d.fat, fiber: s.fiber + d.fiber }), { protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const macroCals = macroCalories(totals.protein, totals.carbs, totals.fat);
  const macroSplit = macroCals > 0
    ? { protein: round((totals.protein * 4 * 100) / macroCals), carbs: round((totals.carbs * 4 * 100) / macroCals), fat: round((totals.fat * 9 * 100) / macroCals) }
    : null;
  const avgFiber = loggedDays ? Math.round((totals.fiber / loggedDays) * 10) / 10 : 0;

  const weekWater = week.map((d) => waterByDay[d.day] ?? 0);
  const totalWaterMl = weekWater.reduce((s, ml) => s + ml, 0);
  const waterDaysCount = weekWater.filter((ml) => ml > 0).length;
  const avgWaterMl = waterDaysCount ? round(totalWaterMl / waterDaysCount) : 0;

  const callouts: string[] = [];
  callouts.push(`Logged food on ${loggedDays} of 7 days`);
  if (vsTarget != null) callouts.push(vsTarget <= 0 ? `Averaging ${Math.abs(vsTarget)} cal under target` : `Averaging ${vsTarget} cal over target`);
  if (macroSplit) callouts.push(`Protein ${macroSplit.protein}% · carbs ${macroSplit.carbs}% · fat ${macroSplit.fat}% of calories`);
  if (totalWaterMl > 0) callouts.push(`Water ${(totalWaterMl / 1000).toFixed(1)} L this week`);
  return { loggedDays, avgCalories, avgGoal, vsTarget, macroSplit, avgFiber, totalWaterMl, avgWaterMl, callouts };
}

export type Achievement = {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  progress?: { current: number; target: number };
};

const STREAK_MILESTONES = [3, 7, 14, 30, 100];

/** Earned and in-progress achievements from the streak and the 30-day series. */
export function achievements(streak: number, series: DaySeries[], fiberGoal: number): Achievement[] {
  const loggedCount = series.filter((d) => d.mealCount > 0).length;
  const fiberDays = series.filter((d) => d.mealCount > 0 && d.fiber >= fiberGoal).length;

  const list: Achievement[] = STREAK_MILESTONES.map((n) => ({
    id: `streak-${n}`,
    title: `${n}-day streak`,
    description: `Log food ${n} days in a row`,
    earned: streak >= n,
    progress: { current: Math.min(streak, n), target: n },
  }));

  list.push({
    id: "days-20",
    title: "Consistency",
    description: "Log food on 20 days in the last 30",
    earned: loggedCount >= 20,
    progress: { current: Math.min(loggedCount, 20), target: 20 },
  });
  list.push({
    id: "fiber-7",
    title: "Fiber fan",
    description: "Hit your fiber goal on 7 days in the last 30",
    earned: fiberDays >= 7,
    progress: { current: Math.min(fiberDays, 7), target: 7 },
  });
  return list;
}

export function nextAchievement(list: Achievement[]): Achievement | null {
  return list.find((a) => !a.earned) ?? null;
}

function isoDaysAgo(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
