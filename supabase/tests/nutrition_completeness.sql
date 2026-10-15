-- Rollback-only integration checks for aggregation, local dates and account isolation.
begin;
select set_config('kenko.test_a', gen_random_uuid()::text, true);
select set_config('kenko.test_b', gen_random_uuid()::text, true);
insert into auth.users(id) values (current_setting('kenko.test_a')::uuid), (current_setting('kenko.test_b')::uuid);
insert into public.meal_logs(user_id,logged_at,calories,protein_g,carbs_g,fat_g,fiber_g,confirmed) values
(current_setting('kenko.test_a')::uuid,'2026-07-08T22:30:00Z',100,null,20,0,null,true),
(current_setting('kenko.test_a')::uuid,'2026-07-08T23:00:00Z',0,0,0,0,0,true),
(current_setting('kenko.test_a')::uuid,'2026-07-08T23:15:00Z',999,null,null,null,null,false),
(current_setting('kenko.test_b')::uuid,'2026-07-08T22:30:00Z',500,10,20,30,5,true);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('kenko.test_a'),'role','authenticated')::text,true);
do $$ declare result record; begin
  select * into strict result from public.daily_nutrition_summary_v2(current_setting('kenko.test_a')::uuid,'2026-07-09','2026-07-09','Europe/Brussels');
  if result.calories <> 100 or result.meal_count <> 2 or result.incomplete_meal_count <> 1
    or result.missing_protein_count <> 1 or result.missing_fiber_count <> 1
    or result.missing_carbs_count <> 0 or result.missing_fat_count <> 0
    or result.protein_g <> 0 or result.carbs_g <> 20 or result.fat_g <> 0 or result.fiber_g <> 0 then
    raise exception 'Incorrect nutrition or completeness totals';
  end if;
  if exists(select 1 from public.daily_nutrition_summary_v2(current_setting('kenko.test_b')::uuid,'2026-07-08','2026-07-09','UTC')) then raise exception 'Other account summary leaked'; end if;
  if exists(select 1 from public.daily_nutrition_summary_v2(current_setting('kenko.test_a')::uuid,'2026-07-08','2026-07-08','Europe/Brussels')) then raise exception 'Summary ignored local date'; end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform * from public.daily_nutrition_summary_v2(current_setting('kenko.test_a')::uuid,'2026-07-08','2026-07-09','UTC');
    raise exception 'Anonymous summary execution allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
