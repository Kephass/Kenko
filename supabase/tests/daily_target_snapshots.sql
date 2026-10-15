-- Run against a migrated development database as postgres. All fixtures roll back.
begin;
select set_config('kenko.test_a', gen_random_uuid()::text, true);
select set_config('kenko.test_b', gen_random_uuid()::text, true);
insert into auth.users(id) values (current_setting('kenko.test_a')::uuid), (current_setting('kenko.test_b')::uuid);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('kenko.test_a'), 'role', 'authenticated')::text, true);
insert into public.daily_target_snapshots(id, user_id, day, observed_at, goals)
values (gen_random_uuid(), current_setting('kenko.test_a')::uuid, '2026-07-08', '2026-07-08T18:00:00Z', '{"calorieTarget":2000,"protein":150,"carbs":200,"fat":66.6667,"water":2000,"fiber":25,"isFallback":true}');
do $$ begin
  if (select count(*) from public.daily_target_snapshots where user_id = current_setting('kenko.test_a')::uuid) <> 1 then raise exception 'Owner cannot read snapshot'; end if;
  begin
    update public.daily_target_snapshots set day = '2026-07-09';
    raise exception 'Snapshots unexpectedly mutable';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('kenko.test_b'), 'role', 'authenticated')::text, true);
do $$ begin
  if exists(select 1 from public.daily_target_snapshots where user_id = current_setting('kenko.test_a')::uuid) then raise exception 'Other account can read snapshot'; end if;
  begin
    insert into public.daily_target_snapshots(id,user_id,day,observed_at,goals)
    values(gen_random_uuid(),current_setting('kenko.test_a')::uuid,'2026-07-08',now(),'{"calorieTarget":2000,"protein":150,"carbs":200,"fat":67,"water":2000,"fiber":25,"isFallback":true}');
    raise exception 'Other account can write snapshot';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin
    perform 1 from public.daily_target_snapshots;
    raise exception 'Anon can read snapshots';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
