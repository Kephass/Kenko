begin;
select set_config('kenko.test_a',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('kenko.test_a')::uuid);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('kenko.test_a'),'role','authenticated')::text,true);
do $$ declare r record; begin
  select * into strict r from public.weekly_energy_balance(current_setting('kenko.test_a')::uuid,'2026-09-13');
  if r.calories_out is not null or r.balance is not null or r.calories_out_source <> 'insufficient_profile' then raise exception 'Missing profile must not invent expenditure'; end if;
end $$;
insert into public.user_profile(user_id,height_cm,birth_date,biological_sex) values(current_setting('kenko.test_a')::uuid,170,'1990-01-01','female');
do $$ declare r record; begin
  select * into strict r from public.weekly_energy_balance(current_setting('kenko.test_a')::uuid,'2026-09-13');
  if r.calories_out is not null then raise exception 'Missing weight must not invent expenditure'; end if;
end $$;
insert into public.weigh_ins(user_id,weight_kg,logged_at) values(current_setting('kenko.test_a')::uuid,65,'2026-09-13T12:00:00Z');
do $$ declare r record; begin
  select * into strict r from public.weekly_energy_balance(current_setting('kenko.test_a')::uuid,'2026-09-13');
  if r.calories_out is null or r.calories_out <= 0 or r.calories_out_source <> 'bmr_formula_estimate' then raise exception 'Complete profile should retain calculated expenditure'; end if;
  begin
    perform * from public.weekly_energy_balance(gen_random_uuid(),'2026-09-13');
    raise exception 'Other account request allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
