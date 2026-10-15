begin;
select set_config('kenko.test_a', gen_random_uuid()::text, true);
select set_config('kenko.test_b', gen_random_uuid()::text, true);
insert into auth.users(id) values (current_setting('kenko.test_a')::uuid), (current_setting('kenko.test_b')::uuid);
insert into public.water_logs(user_id,logged_at,amount_ml)
select current_setting('kenko.test_a')::uuid,'2026-07-08T22:30:00Z',1 from generate_series(1,1001);
insert into public.water_logs(user_id,logged_at,amount_ml) values
(current_setting('kenko.test_a')::uuid,'2026-07-08T21:59:59Z',50),
(current_setting('kenko.test_a')::uuid,'2026-07-09T22:00:00Z',75),
(current_setting('kenko.test_b')::uuid,'2026-07-08T22:30:00Z',500);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('kenko.test_a'),'role','authenticated')::text,true);
do $$ declare result record; begin
  select * into strict result from public.daily_water_summary(current_setting('kenko.test_a')::uuid,'2026-07-09','2026-07-09','Europe/Brussels');
  if result.amount_ml <> 1001 or result.entry_count <> 1001 or result.day <> '2026-07-09'::date then raise exception 'Water aggregation or local boundaries incorrect'; end if;
  select * into strict result from public.daily_water_summary(current_setting('kenko.test_a')::uuid,'2026-07-08','2026-07-08','UTC');
  if result.amount_ml <> 1051 or result.entry_count <> 1002 then raise exception 'UTC aggregation incorrect'; end if;
  if exists(select 1 from public.daily_water_summary(current_setting('kenko.test_b')::uuid,'2026-07-08','2026-07-10','UTC')) then raise exception 'Other owner leaked'; end if;
  if exists(select 1 from public.daily_water_summary(current_setting('kenko.test_a')::uuid,'2026-07-11','2026-07-11','UTC')) then raise exception 'Empty day fabricated'; end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform * from public.daily_water_summary(current_setting('kenko.test_a')::uuid,'2026-07-08','2026-07-09','UTC');
    raise exception 'Anonymous access allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
