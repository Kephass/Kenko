-- Kenko Smart Points: record a food-quality points value per logged meal so
-- zero-point foods (fruit, non-starchy veg) stay zero and historical points are
-- stable even if the formula changes. Nullable; clients fall back to computing
-- points from macros when absent (older rows, offline entries).
alter table public.meal_logs add column if not exists points numeric;

comment on column public.meal_logs.points is
  'Kenko Smart Points spent on this entry. Null = compute from macros client-side.';
