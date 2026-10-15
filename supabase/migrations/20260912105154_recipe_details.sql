-- Keep ingredient nutrition snapshots with the owning dish so later source edits
-- or deletions cannot silently change an existing recipe. Existing dish RLS applies.
alter table public.dishes add column recipe_details jsonb;
alter table public.dishes add constraint recipe_details_shape check (
  recipe_details is null or coalesce((
    jsonb_typeof(recipe_details) = 'object'
    and recipe_details->>'version' = '1'
    and jsonb_typeof(recipe_details->'ingredients') = 'array'
    and jsonb_typeof(recipe_details->'yieldGrams') = 'number'
    and jsonb_typeof(recipe_details->'servings') = 'number'
    and octet_length(recipe_details::text) <= 200000
  ), false)
);
