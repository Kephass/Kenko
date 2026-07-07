-- ----------------------------------------------------------------------------
-- Backfill-safe weight trend: recompute the whole EWMA series for a user
-- whenever a weigh-in is inserted, deleted, or has its weight/date changed.
-- Replaces the insert-only BEFORE trigger, which assumed forward-chronological
-- logging and silently produced wrong trends on backfill.
-- ----------------------------------------------------------------------------
drop trigger if exists set_weight_trend on weigh_ins;
drop function if exists compute_weight_trend();

create or replace function recompute_weight_trend(p_user_id uuid)
returns void as $$
declare
  r record;
  prev numeric := null;
  alpha numeric := 0.15;
begin
  for r in
    select id, weight_kg from weigh_ins
    where user_id = p_user_id
    order by logged_at, created_at, id
  loop
    if prev is null then
      prev := r.weight_kg;
    else
      prev := prev + alpha * (r.weight_kg - prev);
    end if;
    update weigh_ins set trend_weight_kg = round(prev, 2) where id = r.id;
  end loop;
end;
$$ language plpgsql;

-- Fires only on weight_kg/logged_at updates; recompute writes trend_weight_kg
-- alone, so it never re-triggers itself.
create or replace function trigger_recompute_weight_trend()
returns trigger as $$
begin
  perform recompute_weight_trend(coalesce(new.user_id, old.user_id));
  return null;
end;
$$ language plpgsql;

create trigger recompute_weight_trend_after
after insert or delete or update of weight_kg, logged_at on weigh_ins
for each row execute function trigger_recompute_weight_trend();

-- One-time backfill so pre-existing rows match the new semantics
select recompute_weight_trend(user_id)
from (select distinct user_id from weigh_ins) u;

-- ----------------------------------------------------------------------------
-- Per-day nutrition rollup for the week strip, calendar, and charts.
-- Days are bucketed in the caller's timezone; confirmed logs only.
-- ----------------------------------------------------------------------------
create or replace function daily_nutrition_summary(
  p_user_id uuid,
  p_start date,
  p_end date,
  p_tz text default 'UTC'
) returns table (
  day date,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  meal_count bigint
) as $$
  select
    (logged_at at time zone p_tz)::date as day,
    sum(calories),
    sum(coalesce(protein_g, 0)),
    sum(coalesce(carbs_g, 0)),
    sum(coalesce(fat_g, 0)),
    sum(coalesce(fiber_g, 0)),
    count(*)
  from meal_logs
  where user_id = p_user_id
    and confirmed
    and (logged_at at time zone p_tz)::date between p_start and p_end
  group by 1
  order by 1;
$$ language sql stable;
