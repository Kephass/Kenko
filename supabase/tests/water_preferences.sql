-- Development schema and real-role isolation checks. Run as postgres; fixtures roll back.
begin;
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.water_preferences'::regclass) then
    raise exception 'Water preferences require row-level security';
  end if;
  if has_table_privilege('anon', 'public.water_preferences', 'select') then
    raise exception 'Anonymous access must be revoked';
  end if;
end $$;
create temporary table preference_shape (like public.water_preferences including constraints including defaults);
do $$
begin
  insert into preference_shape(user_id, preferences) values (gen_random_uuid(), '{"unit":"ml","containers":[{"name":"Cup","ml":200},{"name":"Bottle","ml":500},{"name":"Jug","ml":1000}]}');
  begin
    update preference_shape set preferences = '{"unit":"ml","containers":[]}';
    raise exception 'Invalid container count accepted';
  exception when check_violation then null;
  end;
end $$;

-- Exercise the policies as application roles, not as the table owner.
select set_config('kenko.test_a', gen_random_uuid()::text, true);
select set_config('kenko.test_b', gen_random_uuid()::text, true);
insert into auth.users(id) values (current_setting('kenko.test_a')::uuid), (current_setting('kenko.test_b')::uuid);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('kenko.test_a'), 'role', 'authenticated')::text, true);
insert into public.water_preferences(user_id, preferences) values (current_setting('kenko.test_a')::uuid, '{"unit":"ml","containers":[{"name":"Cup","ml":200},{"name":"Bottle","ml":500},{"name":"Jug","ml":1000}]}');
do $$ declare affected integer; begin
  if (select count(*) from public.water_preferences where user_id = current_setting('kenko.test_a')::uuid) <> 1 then raise exception 'Owner cannot read water_preferences'; end if;
  update public.water_preferences set updated_at = now() where user_id = current_setting('kenko.test_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner cannot update water_preferences'; end if;
  begin
    update public.water_preferences set user_id = current_setting('kenko.test_b')::uuid where user_id = current_setting('kenko.test_a')::uuid;
    raise exception 'Owner can transfer water_preferences to another account';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('kenko.test_b'), 'role', 'authenticated')::text, true);
do $$ declare affected integer; begin
  if exists(select 1 from public.water_preferences where user_id = current_setting('kenko.test_a')::uuid) then raise exception 'Other account can read water_preferences'; end if;
  update public.water_preferences set updated_at = now() where user_id = current_setting('kenko.test_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other account can update water_preferences'; end if;
  delete from public.water_preferences where user_id = current_setting('kenko.test_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other account can delete water_preferences'; end if;
  begin
    insert into public.water_preferences(user_id, preferences) values (current_setting('kenko.test_a')::uuid, '{"unit":"ml","containers":[{"name":"Cup","ml":200},{"name":"Bottle","ml":500},{"name":"Jug","ml":1000}]}');
    raise exception 'Other account can insert water_preferences for owner';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  if has_table_privilege('anon', 'public.water_preferences', 'SELECT, INSERT, UPDATE, DELETE') then raise exception 'Anon has access to water_preferences'; end if;
  begin
    perform 1 from public.water_preferences;
    raise exception 'Anon can read water_preferences';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('kenko.test_a'), 'role', 'authenticated')::text, true);
do $$ declare affected integer; begin
  delete from public.water_preferences where user_id = current_setting('kenko.test_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner cannot delete water_preferences'; end if;
end $$;
rollback;
