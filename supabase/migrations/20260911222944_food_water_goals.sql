-- Existing profile ownership policies also cover these preferences.
alter table public.user_profile
  add column calorie_target_override numeric check (calorie_target_override > 0 and calorie_target_override < 'Infinity'::numeric),
  add column protein_pct numeric not null default 30 check (protein_pct > 0 and protein_pct < 100),
  add column carbs_pct numeric not null default 40 check (carbs_pct > 0 and carbs_pct < 100),
  add column fat_pct numeric not null default 30 check (fat_pct > 0 and fat_pct < 100),
  add column water_goal_ml numeric not null default 2000 check (water_goal_ml > 0 and water_goal_ml < 'Infinity'::numeric),
  add column fiber_goal_g numeric not null default 25 check (fiber_goal_g > 0 and fiber_goal_g < 'Infinity'::numeric),
  add constraint macro_split_total check (protein_pct + carbs_pct + fat_pct = 100);

-- NOT VALID preserves legacy rows but rejects invalid new/updated entries.
alter table public.water_logs add constraint positive_water_amount
  check (amount_ml > 0 and amount_ml < 'Infinity'::numeric) not valid;
alter table public.meal_logs add constraint nonnegative_meal_nutrition
  check (
    calories >= 0 and calories < 'Infinity'::numeric
    and (protein_g is null or (protein_g >= 0 and protein_g < 'Infinity'::numeric))
    and (carbs_g is null or (carbs_g >= 0 and carbs_g < 'Infinity'::numeric))
    and (fat_g is null or (fat_g >= 0 and fat_g < 'Infinity'::numeric))
    and (fiber_g is null or (fiber_g >= 0 and fiber_g < 'Infinity'::numeric))
    and (portion_ratio is null or (portion_ratio > 0 and portion_ratio < 'Infinity'::numeric))
  ) not valid;

-- Diary grouping and a small reusable favorites list.
alter table public.meal_logs add column meal_type text not null default 'uncategorized'
  check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'uncategorized'));
-- Preserve the meaning of existing entries without guessing their meal category.
-- Legacy entries remain uncategorized until the user assigns a meal.
alter table public.dishes add column is_favorite boolean not null default false;

alter table public.dishes add constraint valid_dish_nutrition
  check (
    calories_per_100g >= 0 and calories_per_100g < 'Infinity'::numeric
    and protein_g_per_100g >= 0 and protein_g_per_100g < 'Infinity'::numeric
    and carbs_g_per_100g >= 0 and carbs_g_per_100g < 'Infinity'::numeric
    and fat_g_per_100g >= 0 and fat_g_per_100g < 'Infinity'::numeric
    and (fiber_g_per_100g is null or (fiber_g_per_100g >= 0 and fiber_g_per_100g < 'Infinity'::numeric))
    and (reference_serving_g is null or (reference_serving_g > 0 and reference_serving_g < 'Infinity'::numeric))
  ) not valid;
