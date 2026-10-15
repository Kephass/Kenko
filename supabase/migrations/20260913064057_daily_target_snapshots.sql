-- Append-only observations: later profile/estimate changes never rewrite earlier days.
-- day is the local diary date at capture, observed_at preserves offline ordering.
create table public.daily_target_snapshots (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  observed_at timestamptz not null,
  goals jsonb not null,
  constraint target_snapshot_shape check (
    jsonb_typeof(goals) = 'object' and
    goals ?& array['calorieTarget','protein','carbs','fat','water','fiber','isFallback'] and
    jsonb_typeof(goals->'isFallback') = 'boolean' and
    jsonb_typeof(goals->'calorieTarget') = 'number' and (goals->>'calorieTarget')::numeric > 0 and
    jsonb_typeof(goals->'protein') = 'number' and (goals->>'protein')::numeric > 0 and
    jsonb_typeof(goals->'carbs') = 'number' and (goals->>'carbs')::numeric > 0 and
    jsonb_typeof(goals->'fat') = 'number' and (goals->>'fat')::numeric > 0 and
    jsonb_typeof(goals->'water') = 'number' and (goals->>'water')::numeric > 0 and
    jsonb_typeof(goals->'fiber') = 'number' and (goals->>'fiber')::numeric > 0
  )
);
create index daily_target_snapshots_owner_day on public.daily_target_snapshots(user_id, day, observed_at);
alter table public.daily_target_snapshots enable row level security;
revoke all on public.daily_target_snapshots from anon, authenticated;
grant select, insert on public.daily_target_snapshots to authenticated;
create policy "Read own target observations" on public.daily_target_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy "Record own target observations" on public.daily_target_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
