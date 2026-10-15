export type Completeness = { incomplete_meal_count?: number; missing_protein_count?: number; missing_carbs_count?: number; missing_fat_count?: number; missing_fiber_count?: number };
export function completenessMessage(row: Completeness | undefined) {
  if (!row || row.incomplete_meal_count == null) return "";
  const count = Number(row.incomplete_meal_count);
  if (count <= 0) return "";
  const missing = ([['missing_protein_count', 'protein'], ['missing_carbs_count', 'carbs'], ['missing_fat_count', 'fat'], ['missing_fiber_count', 'fiber']] as const)
    .filter(([key]) => Number(row[key] ?? 0) > 0)
    .map(([key, label]) => `${label} (${Number(row[key])})`);
  return `${count} ${count === 1 ? 'food has' : 'foods have'} incomplete nutrition. Missing values: ${missing.join(', ')}. Totals include known amounts only.`;
}
