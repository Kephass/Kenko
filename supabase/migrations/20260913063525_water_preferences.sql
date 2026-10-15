create table public.water_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null check (
    coalesce(jsonb_typeof(preferences) = 'object' and preferences->>'unit' in ('ml','us-fl-oz')
      and case when jsonb_typeof(preferences->'containers') = 'array' then jsonb_array_length(preferences->'containers') = 3 else false end, false)
  ),
  updated_at timestamptz not null default now()
);
alter table public.water_preferences enable row level security;
create policy "own water preferences" on public.water_preferences for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.water_preferences from anon, authenticated;
grant select, insert, update, delete on public.water_preferences to authenticated;
