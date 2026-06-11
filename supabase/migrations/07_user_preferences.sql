-- user_preferences table + RLS (owner-only). Run AFTER 06_exercise_records.sql.
--
-- Phase 2 feature: the TABLE STRUCTURE is created now but the feature is NOT
-- activated (no form / no AI recommendation yet). Created here so later phases
-- can write to it without another migration round-trip.
--
-- Doc -> column mapping:
--   선호 운동 시간대 -> preferred_exercise_times text[]  (예: {"06:00-08:00"})
--   선호 운동 부위   -> preferred_exercise_parts text[]  (예: {"chest","back"})
--   운동 목표        -> fitness_goal ('muscle_gain'|'fat_loss'|'endurance'
--                       = 근력증가/지방감소/체력향상)
-- One row per user (unique user_id).

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  preferred_exercise_times text[],
  preferred_exercise_parts text[],
  fitness_goal text check (fitness_goal is null or fitness_goal in ('muscle_gain', 'fat_loss', 'endurance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reuse the set_updated_at() function defined in 01_init_profiles.sql.
drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences: read own" on public.user_preferences;
create policy "user_preferences: read own" on public.user_preferences
  for select using (auth.uid() = user_id);

drop policy if exists "user_preferences: insert own" on public.user_preferences;
create policy "user_preferences: insert own" on public.user_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_preferences: update own" on public.user_preferences;
create policy "user_preferences: update own" on public.user_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_preferences: delete own" on public.user_preferences;
create policy "user_preferences: delete own" on public.user_preferences
  for delete using (auth.uid() = user_id);
