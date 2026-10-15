-- An omitted label nutrient is unknown, not a measured zero.
-- Preserve existing numeric values; their original meaning cannot be inferred.
alter table public.dishes
  alter column protein_g_per_100g drop not null,
  alter column protein_g_per_100g drop default,
  alter column carbs_g_per_100g drop not null,
  alter column carbs_g_per_100g drop default,
  alter column fat_g_per_100g drop not null,
  alter column fat_g_per_100g drop default,
  alter column fiber_g_per_100g drop default;
