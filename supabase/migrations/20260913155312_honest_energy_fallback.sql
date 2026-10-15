create or replace function public.weekly_energy_balance(p_user_id uuid, p_as_of date default current_date)
returns table (
  calories_in numeric,
  calories_out numeric,
  balance numeric,
  calories_out_source text
) as $$
declare
  v_active_kcal numeric;
  v_bmr numeric;
  v_weight numeric;
  v_age numeric;
  v_bf numeric;
  v_profile public.user_profile%rowtype;
begin
  if p_user_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(sum(calories), 0) into calories_in
  from public.meal_logs
  where user_id = p_user_id
    and logged_at >= p_as_of - interval '6 days'
    and logged_at < p_as_of + interval '1 day';

  select * into v_profile from public.user_profile where user_id = p_user_id;

  select weight_kg into v_weight
  from public.weigh_ins where user_id = p_user_id
  order by logged_at desc limit 1;

  -- Missing body inputs are unknown, not a fictional 70 kg, 170 cm, age-30 man.
  if v_weight is null or v_weight <= 0 or v_profile.height_cm is null or v_profile.height_cm <= 0
    or v_profile.birth_date is null or v_profile.birth_date >= p_as_of
    or v_profile.biological_sex is null or v_profile.biological_sex not in ('male', 'female') then
    calories_out := null;
    balance := null;
    calories_out_source := 'insufficient_profile';
    return next;
    return;
  end if;

  v_age := extract(year from age(p_as_of, v_profile.birth_date));
  v_bf := public.latest_body_fat_estimate(p_user_id);

  v_bmr := public.calculate_bmr(
    v_weight,
    v_profile.height_cm,
    v_age,
    v_profile.biological_sex,
    v_bf
  );

  select sum(active_kcal) into v_active_kcal
  from public.activity
  where user_id = p_user_id
    and activity_date between (p_as_of - interval '6 days')::date and p_as_of
    and source in ('healthkit', 'googlefit');

  if v_active_kcal is not null then
    calories_out := (v_bmr * 7) + v_active_kcal;
    calories_out_source := 'bmr_plus_wearable';
  else
    calories_out := v_bmr * 7 * coalesce(v_profile.activity_multiplier, 1.375);
    calories_out_source := 'bmr_formula_estimate';
  end if;

  balance := calories_in - calories_out;
  return next;
end;
$$ language plpgsql stable security invoker set search_path = public, pg_temp;
revoke all on function public.weekly_energy_balance(uuid,date) from public, anon;
grant execute on function public.weekly_energy_balance(uuid,date) to authenticated;
