-- Add a new RPC instead of changing the return shape for existing clients.
create function public.daily_nutrition_summary_v2(p_user_id uuid, p_start date, p_end date, p_tz text default 'UTC')
returns table(day date, calories numeric, protein_g numeric, carbs_g numeric, fat_g numeric, fiber_g numeric,
  meal_count bigint, incomplete_meal_count bigint, missing_protein_count bigint, missing_carbs_count bigint, missing_fat_count bigint, missing_fiber_count bigint)
language sql stable security invoker set search_path = '' as $$
  select (m.logged_at at time zone p_tz)::date,
    sum(m.calories), sum(coalesce(m.protein_g,0)), sum(coalesce(m.carbs_g,0)), sum(coalesce(m.fat_g,0)), sum(coalesce(m.fiber_g,0)), count(*),
    count(*) filter (where m.protein_g is null or m.carbs_g is null or m.fat_g is null or m.fiber_g is null),
    count(*) filter (where m.protein_g is null), count(*) filter (where m.carbs_g is null),
    count(*) filter (where m.fat_g is null), count(*) filter (where m.fiber_g is null)
  from public.meal_logs m
  where m.user_id = p_user_id and m.user_id = (select auth.uid()) and m.confirmed
    and (m.logged_at at time zone p_tz)::date between p_start and p_end
  group by 1 order by 1;
$$;
revoke all on function public.daily_nutrition_summary_v2(uuid,date,date,text) from public, anon;
grant execute on function public.daily_nutrition_summary_v2(uuid,date,date,text) to authenticated;
