-- Weight-goal pace: how fast the user wants to lose or gain, in kg per week.
-- Combined with the weight goal (cut/bulk) it turns maintenance calories into a
-- goal-adjusted target, which in turn drives the daily points budget. Null uses
-- the default pace in app code; maintain ignores it.
alter table public.user_profile add column if not exists weekly_rate_kg numeric;

comment on column public.user_profile.weekly_rate_kg is
  'Target weight change in kg per week; applied as a calorie deficit/surplus with the goal.';
