-- Run after recipe_details migration. Test constraints without touching user rows.
begin;
create temporary table recipe_shape_test (like public.dishes including constraints);
do $$
begin
  insert into recipe_shape_test (id, user_id, name, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, source, created_at, updated_at, is_favorite, recipe_details)
  values (gen_random_uuid(), gen_random_uuid(), 'Test recipe', 0, 0, 0, 0, 'custom_recipe', now(), now(), false,
    '{"version":1,"ingredients":[],"yieldGrams":100,"servings":1}');
  begin
    update recipe_shape_test set recipe_details = '{"version":1}';
    raise exception 'Incomplete recipe shape was accepted';
  exception when check_violation then null;
  end;
  update recipe_shape_test set recipe_details = null, protein_g_per_100g = null, carbs_g_per_100g = null, fat_g_per_100g = null, fiber_g_per_100g = null;
end $$;
rollback;
