-- ============================================================================
-- Kenko: initial schema
--
-- A personal nutrition and body-tracking system built around a closed-set
-- dish library rather than a generic global food database. Every
-- user-owned table is scoped by user_id with row-level security, so this
-- supports any number of independent people on one Supabase project - each
-- person builds their own dish library and sees only their own data.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ----------------------------------------------------------------------------
-- Profile: static info needed for BMR calculations
-- ----------------------------------------------------------------------------
create table user_profile (
  user_id uuid primary key references auth.users(id),
  height_cm numeric,
  birth_date date,
  biological_sex text check (biological_sex in ('male', 'female')),
  goal text check (goal in ('cut', 'maintain', 'bulk')) default 'maintain',
  -- used as a fallback multiplier over BMR when no wearable activity data
  -- exists yet; ~1.2 sedentary, ~1.375 lightly active, ~1.55 moderately active
  activity_multiplier numeric not null default 1.375,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Reference ingredient data, used to ground the AI's reasoning about
-- unfamiliar dishes instead of trusting a model's memorized nutrition facts.
-- Shared across all users on this project (not scoped by user_id) - it's
-- reference data, not personal data.
--
-- Named for this reference implementation's source, the FAO/INFOODS Food
-- Composition Table for Western Africa (WAFCT 2019), but the structure is
-- generic: any per-ingredient composition table works here (USDA
-- FoodData Central, Brazil's TACO, a national table, etc). Populate this
-- with whatever source actually covers the cuisine you're tracking.
-- ----------------------------------------------------------------------------
create table wafct_ingredients (
  food_code text primary key,
  name_en text not null,
  name_fr text,
  calories_per_100g numeric,
  protein_g_per_100g numeric,
  carbs_g_per_100g numeric,
  fat_g_per_100g numeric,
  fiber_g_per_100g numeric
);

-- ----------------------------------------------------------------------------
-- Dishes: your personal, closed-set recipe library
-- ----------------------------------------------------------------------------
create table dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  name_local text,
  source text not null check (source in ('wafct', 'custom_recipe', 'estimated')) default 'custom_recipe',
  calories_per_100g numeric not null,
  protein_g_per_100g numeric not null default 0,
  carbs_g_per_100g numeric not null default 0,
  fat_g_per_100g numeric not null default 0,
  fiber_g_per_100g numeric default 0,
  reference_serving_g numeric,
  notes text,
  -- NOTE: dimension is a placeholder - set this to match whichever embedding
  -- model your bake-off picks (e.g. 768, 1024, 1536) before running this
  -- migration for real.
  embedding vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dish_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  dish_id uuid not null references dishes(id) on delete cascade,
  ingredient_name text not null,
  source_food_code text references wafct_ingredients(food_code),
  grams numeric not null,
  created_at timestamptz not null default now()
);

create table dishware (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  reference_photo_url text,
  reference_volume_ml numeric,
  reference_fill_grams numeric,
  created_at timestamptz not null default now()
);

create table meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  logged_at timestamptz not null default now(),
  dish_id uuid references dishes(id),
  dishware_id uuid references dishware(id),
  portion_ratio numeric,
  calories numeric not null,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  photo_url text,
  raw_text_input text,
  source text not null check (source in ('ai_estimate', 'manual', 'scale', 'text')) default 'manual',
  match_confidence numeric,
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table dish_calibration (
  dish_id uuid primary key references dishes(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  correction_multiplier numeric not null default 1.0,
  sample_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  logged_at timestamptz not null default now(),
  weight_kg numeric not null,
  trend_weight_kg numeric,
  created_at timestamptz not null default now()
);

create table measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  logged_at timestamptz not null default now(),
  measurement_type text not null check (measurement_type in ('waist', 'hip', 'chest', 'neck', 'thigh', 'arm')),
  value_cm numeric not null,
  created_at timestamptz not null default now()
);

create table water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  logged_at timestamptz not null default now(),
  amount_ml numeric not null
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  activity_date date not null,
  active_kcal numeric,
  steps integer,
  source text not null check (source in ('healthkit', 'googlefit', 'manual', 'estimate')) default 'estimate',
  created_at timestamptz not null default now(),
  unique (user_id, activity_date, source)
);

create table ai_call_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  called_at timestamptz not null default now(),
  provider text not null,
  model text not null,
  purpose text not null check (purpose in ('embedding', 'classification', 'reasoning')),
  estimated_cost_usd numeric,
  meal_log_id uuid references meal_logs(id)
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index on dishes using hnsw (embedding vector_cosine_ops);
create index on meal_logs (user_id, logged_at desc);
create index on weigh_ins (user_id, logged_at desc);
create index on measurements (user_id, logged_at desc);
create index on water_logs (user_id, logged_at desc);
create index on activity (user_id, activity_date desc);

-- ----------------------------------------------------------------------------
-- Row-level security: every user-owned table is scoped to auth.uid()
-- ----------------------------------------------------------------------------
alter table user_profile enable row level security;
alter table dishes enable row level security;
alter table dish_ingredients enable row level security;
alter table dishware enable row level security;
alter table meal_logs enable row level security;
alter table dish_calibration enable row level security;
alter table weigh_ins enable row level security;
alter table measurements enable row level security;
alter table water_logs enable row level security;
alter table activity enable row level security;
alter table ai_call_log enable row level security;

create policy "own profile" on user_profile for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own dishes" on dishes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own dish_ingredients" on dish_ingredients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own dishware" on dishware for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own meal_logs" on meal_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own dish_calibration" on dish_calibration for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own weigh_ins" on weigh_ins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own measurements" on measurements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own water_logs" on water_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own activity" on activity for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own ai_call_log" on ai_call_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- wafct_ingredients is shared reference data, readable by any authenticated user
alter table wafct_ingredients enable row level security;
create policy "read wafct" on wafct_ingredients for select using (true);

-- ----------------------------------------------------------------------------
-- Weight trend: exponentially-weighted moving average, computed on insert
-- NOTE: assumes forward-chronological logging. Backfilling an old date will
-- not retroactively recompute later trend values - fine for daily use, but
-- worth knowing if you ever backfill a gap.
-- ----------------------------------------------------------------------------
create or replace function compute_weight_trend()
returns trigger as $$
declare
  prev_trend numeric;
  alpha numeric := 0.15;
begin
  select trend_weight_kg into prev_trend
  from weigh_ins
  where user_id = new.user_id
  order by logged_at desc
  limit 1;

  if prev_trend is null then
    new.trend_weight_kg := new.weight_kg;
  else
    new.trend_weight_kg := prev_trend + alpha * (new.weight_kg - prev_trend);
  end if;

  return new;
end;
$$ language plpgsql;

create trigger set_weight_trend
before insert on weigh_ins
for each row execute function compute_weight_trend();

-- ----------------------------------------------------------------------------
-- Navy method body-fat estimate from tape measurements
-- ----------------------------------------------------------------------------
create or replace function estimate_body_fat_navy(
  waist_cm numeric,
  neck_cm numeric,
  height_cm numeric,
  hip_cm numeric default null,
  sex text default 'male'
) returns numeric as $$
begin
  if sex = 'male' then
    return round(
      (495 / (1.0324 - 0.19077 * log(waist_cm - neck_cm) + 0.15456 * log(height_cm)) - 450)::numeric,
      1
    );
  else
    if hip_cm is null then
      raise exception 'hip_cm is required for the female Navy method formula';
    end if;
    return round(
      (495 / (1.29579 - 0.35004 * log(waist_cm + hip_cm - neck_cm) + 0.22100 * log(height_cm)) - 450)::numeric,
      1
    );
  end if;
end;
$$ language plpgsql immutable;

create or replace function latest_body_fat_estimate(p_user_id uuid)
returns numeric as $$
declare
  v_waist numeric;
  v_neck numeric;
  v_hip numeric;
  v_height numeric;
  v_sex text;
begin
  select value_cm into v_waist from measurements where user_id = p_user_id and measurement_type = 'waist' order by logged_at desc limit 1;
  select value_cm into v_neck from measurements where user_id = p_user_id and measurement_type = 'neck' order by logged_at desc limit 1;
  select value_cm into v_hip from measurements where user_id = p_user_id and measurement_type = 'hip' order by logged_at desc limit 1;
  select height_cm, biological_sex into v_height, v_sex from user_profile where user_id = p_user_id;

  if v_waist is null or v_neck is null or v_height is null then
    return null;
  end if;

  return estimate_body_fat_navy(v_waist, v_neck, v_height, v_hip, coalesce(v_sex, 'male'));
end;
$$ language plpgsql stable;

-- ----------------------------------------------------------------------------
-- BMR: Katch-McArdle once body fat % is known, Mifflin-St Jeor otherwise
-- ----------------------------------------------------------------------------
create or replace function calculate_bmr(
  weight_kg numeric,
  height_cm numeric,
  age_years numeric,
  sex text,
  body_fat_pct numeric default null
) returns numeric as $$
declare
  lean_mass_kg numeric;
begin
  if body_fat_pct is not null then
    lean_mass_kg := weight_kg * (1 - body_fat_pct / 100);
    return round((370 + 21.6 * lean_mass_kg)::numeric, 0);
  else
    if sex = 'male' then
      return round((10 * weight_kg + 6.25 * height_cm - 5 * age_years + 5)::numeric, 0);
    else
      return round((10 * weight_kg + 6.25 * height_cm - 5 * age_years - 161)::numeric, 0);
    end if;
  end if;
end;
$$ language plpgsql immutable;

-- ----------------------------------------------------------------------------
-- Rolling 7-day energy balance (works for cut, maintain, or bulk - just a
-- signed number; interpret the sign relative to your own goal)
-- ----------------------------------------------------------------------------
create or replace function weekly_energy_balance(p_user_id uuid, p_as_of date default current_date)
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
  v_profile user_profile%rowtype;
begin
  select coalesce(sum(calories), 0) into calories_in
  from meal_logs
  where user_id = p_user_id
    and logged_at >= p_as_of - interval '6 days'
    and logged_at < p_as_of + interval '1 day';

  select * into v_profile from user_profile where user_id = p_user_id;

  select weight_kg into v_weight
  from weigh_ins where user_id = p_user_id
  order by logged_at desc limit 1;

  v_age := extract(year from age(current_date, v_profile.birth_date));
  v_bf := latest_body_fat_estimate(p_user_id);

  v_bmr := calculate_bmr(
    coalesce(v_weight, 70),
    coalesce(v_profile.height_cm, 170),
    coalesce(v_age, 30),
    coalesce(v_profile.biological_sex, 'male'),
    v_bf
  );

  select sum(active_kcal) into v_active_kcal
  from activity
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
$$ language plpgsql stable;

-- ----------------------------------------------------------------------------
-- pgvector similarity search, called from the edge function via .rpc()
-- ----------------------------------------------------------------------------
create or replace function match_dish_by_embedding(
  query_embedding vector(768),
  match_user_id uuid,
  match_threshold float default 0.0,
  match_count int default 1
)
returns table (
  id uuid,
  name text,
  calories_per_100g numeric,
  protein_g_per_100g numeric,
  carbs_g_per_100g numeric,
  fat_g_per_100g numeric,
  fiber_g_per_100g numeric,
  reference_serving_g numeric,
  similarity float
)
language sql stable
as $$
  select
    id, name, calories_per_100g, protein_g_per_100g, carbs_g_per_100g,
    fat_g_per_100g, fiber_g_per_100g, reference_serving_g,
    1 - (embedding <=> query_embedding) as similarity
  from dishes
  where user_id = match_user_id
    and embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
