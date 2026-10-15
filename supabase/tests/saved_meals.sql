-- Run on a development database after the saved_meals migration.
begin;
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.saved_meals'::regclass) then
    raise exception 'Saved meals must have row-level security enabled';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_meals' and policyname = 'own saved meals' and cmd = 'ALL') then
    raise exception 'Saved-meal ownership policy is missing';
  end if;
end $$;
create temporary table saved_meals_shape (like public.saved_meals including constraints including defaults);
do $$
begin
  insert into saved_meals_shape(user_id, name, meal_type, foods)
  values (gen_random_uuid(), 'Breakfast', 'breakfast', '[{"name":"Oats","calories":100,"protein_g":null,"carbs_g":20,"fat_g":0,"fiber_g":null}]');
  begin
    update saved_meals_shape set foods = '[]';
    raise exception 'Empty saved meal accepted';
  exception when check_violation then null;
  end;
  begin
    update saved_meals_shape set name = ' ';
    raise exception 'Blank meal name accepted';
  exception when check_violation then null;
  end;
end $$;

-- Exercise the policies as application roles, not as the table owner.
select set_config('kenko.test_a', gen_random_uuid()::text, true);
select set_config('kenko.test_b', gen_random_uuid()::text, true);
insert into auth.users(id) values (current_setting('kenko.test_a')::uuid), (current_setting('kenko.test_b')::uuid);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('kenko.test_a'), 'role', 'authenticated')::text, true);
insert into public.saved_meals(user_id, name, meal_type, foods) values (current_setting('kenko.test_a')::uuid, 'RLS fixture', 'breakfast', '[{"name":"Oats","calories":100}]');
do $$ declare affected integer; begin
  if (select count(*) from public.saved_meals where user_id = current_setting('kenko.test_a')::uuid) <> 1 then raise exception 'Owner cannot read saved_meals'; end if;
  update public.saved_meals set name = 'Updated fixture' where user_id = current_setting('kenko.test_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner cannot update saved_meals'; end if;
  begin
    update public.saved_meals set user_id = current_setting('kenko.test_b')::uuid where user_id = current_setting('kenko.test_a')::uuid;
    raise exception 'Owner can transfer saved_meals to another account';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('kenko.test_b'), 'role', 'authenticated')::text, true);
do $$ declare affected integer; begin
  if exists(select 1 from public.saved_meals where user_id = current_setting('kenko.test_a')::uuid) then raise exception 'Other account can read saved_meals'; end if;
  update public.saved_meals set name = 'Updated fixture' where user_id = current_setting('kenko.test_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other account can update saved_meals'; end if;
  delete from public.saved_meals where user_id = current_setting('kenko.test_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other account can delete saved_meals'; end if;
  begin
    insert into public.saved_meals(user_id, name, meal_type, foods) values (current_setting('kenko.test_a')::uuid, 'RLS fixture', 'breakfast', '[{"name":"Oats","calories":100}]');
    raise exception 'Other account can insert saved_meals for owner';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  if has_table_privilege('anon', 'public.saved_meals', 'SELECT, INSERT, UPDATE, DELETE') then raise exception 'Anon has access to saved_meals'; end if;
  begin
    perform 1 from public.saved_meals;
    raise exception 'Anon can read saved_meals';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('kenko.test_a'), 'role', 'authenticated')::text, true);
do $$ declare affected integer; begin
  delete from public.saved_meals where user_id = current_setting('kenko.test_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner cannot delete saved_meals'; end if;
end $$;
rollback;
