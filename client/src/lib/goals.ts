// Daily targets from the rolling 7-day expenditure; 30/40/30 split, Atwater factors.
export function deriveDailyGoals(caloriesOut7d: number | null | undefined) {
  const calorieTarget = caloriesOut7d ? Number(caloriesOut7d) / 7 : 2000;
  return {
    calorieTarget,
    protein: (calorieTarget * 0.3) / 4,
    carbs: (calorieTarget * 0.4) / 4,
    fat: (calorieTarget * 0.3) / 9,
  };
}
