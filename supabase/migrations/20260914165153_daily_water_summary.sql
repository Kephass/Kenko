-- Aggregate before the API row limit; respect the viewer's local calendar day.
create function public.daily_water_summary(p_user_id uuid, p_start date, p_end date, p_tz text default 'UTC')
returns table(day date, amount_ml numeric, entry_count bigint)
language sql stable security invoker set search_path = '' as $$
  select (w.logged_at at time zone p_tz)::date, sum(w.amount_ml)::numeric, count(*)
  from public.water_logs w
  where w.user_id = p_user_id and w.user_id = (select auth.uid())
    and w.logged_at >= (p_start::timestamp at time zone p_tz)
    and w.logged_at < ((p_end + 1)::timestamp at time zone p_tz)
  group by 1 order by 1;
$$;
revoke all on function public.daily_water_summary(uuid,date,date,text) from public, anon;
grant execute on function public.daily_water_summary(uuid,date,date,text) to authenticated;
