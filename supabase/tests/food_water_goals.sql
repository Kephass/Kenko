-- Run against a development database after applying migrations.
-- Temp copies exercise constraints without inserting or changing user data.
begin;
create temp table test_profile (like public.user_profile including defaults including constraints);
create temp table test_water (like public.water_logs including defaults including constraints);
create temp table test_meal (like public.meal_logs including defaults including constraints);

do $$
declare
  test_user uuid := gen_random_uuid();
  failed boolean;
begin
  insert into test_profile (user_id) values (test_user);
  if not exists (select 1 from test_profile where user_id = test_user and water_goal_ml = 2000 and protein_pct + carbs_pct + fat_pct = 100) then
    raise exception 'Default targets are incorrect';
  end if;
  update test_profile set calorie_target_override = 1800, protein_pct = 25, carbs_pct = 50, fat_pct = 25, water_goal_ml = 2300 where user_id = test_user;
  failed := false;
  begin
    update test_profile set protein_pct = 40 where user_id = test_user;
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'Invalid macro split accepted'; end if;
  failed := false;
  begin
    insert into test_water (user_id, amount_ml) values (test_user, -250);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'Negative water accepted'; end if;
  insert into test_water (user_id, amount_ml) values (test_user, 330);
  failed := false;
  begin
    insert into test_meal (user_id, calories, fiber_g) values (test_user, 100, -1);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'Negative fiber accepted'; end if;
  insert into test_meal (user_id, calories, fiber_g, meal_type) values (test_user, 0, 2.3, 'breakfast');
  failed := false;
  begin
    insert into test_meal (user_id, calories, meal_type) values (test_user, 100, 'invalid');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'Invalid meal category accepted'; end if;
  if exists (select 1 from pg_class where oid in ('public.user_profile'::regclass, 'public.water_logs'::regclass, 'public.meal_logs'::regclass, 'public.dishes'::regclass) and not relrowsecurity) then
    raise exception 'RLS must remain enabled';
  end if;
end $$;
select 'Food/water schema checks passed' as result;
rollback;
