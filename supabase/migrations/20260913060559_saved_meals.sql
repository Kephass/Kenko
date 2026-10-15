create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack','uncategorized')),
  foods jsonb not null check (case when jsonb_typeof(foods) = 'array' then jsonb_array_length(foods) between 1 and 100 else false end),
  created_at timestamptz not null default now()
);
alter table public.saved_meals enable row level security;
create policy "own saved meals" on public.saved_meals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.saved_meals from anon, authenticated;
grant select, insert, update, delete on public.saved_meals to authenticated;
create index saved_meals_owner_name on public.saved_meals(user_id, name);
