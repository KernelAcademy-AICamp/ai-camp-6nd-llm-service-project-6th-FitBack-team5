-- ============================================================
-- FitBack — 통합 DB 셋업 (AUTO-GENERATED — 직접 수정하지 마세요)
-- supabase/migrations/ 의 모든 마이그레이션을 실행 순서대로 합친 파일입니다.
-- 재생성: node scripts/build-setup-sql.js
--
-- 사용법: Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run.
-- 사전 준비: Authentication → Users 에서 테스트 계정을 먼저 만들면
--            03_memberships 의 시드(가데이터)가 그 계정에 자동 연결됩니다.
--            계정이 없으면 시드는 조용히 skip 되고 테이블만 생성됩니다.
-- 멱등성: 모든 마이그레이션은 여러 번 실행해도 안전합니다.
-- ============================================================


-- ████████████████████████████████████████████████████████████
-- 01_init_profiles.sql
-- ████████████████████████████████████████████████████████████

-- profiles + RLS + triggers + is_admin helper
-- Paste into Supabase SQL Editor and run once.

-- ============================================================
-- profiles table
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- updated_at maintenance
-- ============================================================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- Auto-create a profile row when a new auth user is inserted
-- ============================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any users that already exist (e.g. dev test account created in dashboard)
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ============================================================
-- is_admin() helper — defined now but not yet referenced anywhere.
-- Future policies: `using (is_admin() or user_id = auth.uid())`.
-- ============================================================
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- ============================================================
-- Prevent self-elevation: silently ignore role changes from non-admins.
-- Without this, the "update own row" policy would let a user set role='admin'.
-- ============================================================
create or replace function public.prevent_role_self_elevation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role is distinct from new.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_elevation on public.profiles;
create trigger profiles_prevent_role_elevation
  before update on public.profiles
  for each row execute function public.prevent_role_self_elevation();

-- ============================================================
-- RLS — own row only
-- ============================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- No INSERT policy: profiles are inserted only via the SECURITY DEFINER trigger.
-- No DELETE policy: profile rows are removed via auth.users ON DELETE CASCADE.


-- ████████████████████████████████████████████████████████████
-- 02_extend_profiles.sql
-- ████████████████████████████████████████████████████████████

-- Extend profiles with the User health/basic fields from the Phase 1 type doc.
-- Maps the doc's "users" entity onto the existing public.profiles table
-- (profiles.id == auth.users.id, 1:1). Run AFTER 01_init_profiles.sql.
--
-- Doc -> column mapping:
--   이름            -> display_name (already exists)
--   나이            -> age                  (만 나이, integer)
--   성별            -> gender               ('M' | 'F')
--   키 (cm)         -> height               (cm, 100~250)
--   몸무게 (kg)     -> weight               (kg, 20~300, 소수 허용)
--   운동경험        -> exercise_level       ('beginner'|'intermediate'|'advanced' = 초보/중급/고급)
--   부상이력        -> injury_history       (자유 텍스트, 선택)
--   건강 제약사항   -> medical_conditions   (자유 텍스트, 선택)
--   피해야 할 부위  -> avoid_exercise_parts (text[], 다중선택)
-- All columns are nullable: onboarding STEP 2 fills them in after login.

alter table public.profiles
  add column if not exists age integer,
  add column if not exists gender text,
  add column if not exists height numeric(5, 2),
  add column if not exists weight numeric(5, 2),
  add column if not exists exercise_level text,
  add column if not exists injury_history text,
  add column if not exists medical_conditions text,
  add column if not exists avoid_exercise_parts text[];

-- Range / enum checks (guarded so re-running is a no-op).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_age_check') then
    alter table public.profiles
      add constraint profiles_age_check check (age is null or age between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_gender_check') then
    alter table public.profiles
      add constraint profiles_gender_check check (gender is null or gender in ('M', 'F'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_height_check') then
    alter table public.profiles
      add constraint profiles_height_check check (height is null or height between 100 and 250);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_weight_check') then
    alter table public.profiles
      add constraint profiles_weight_check check (weight is null or weight between 20 and 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_exercise_level_check') then
    alter table public.profiles
      add constraint profiles_exercise_level_check
      check (exercise_level is null or exercise_level in ('beginner', 'intermediate', 'advanced'));
  end if;
end $$;


-- ████████████████████████████████████████████████████████████
-- 03_memberships.sql
-- ████████████████████████████████████████████████████████████

-- memberships table + RLS (owner-only) + seed data for the test account.
-- Run AFTER 02_extend_profiles.sql. Paste into Supabase SQL Editor.
--
-- Doc -> column mapping:
--   회원권명     -> name
--   월비용/총액  -> cost        (원 단위 정수)
--   기간         -> period      ('month'|'3month'|'6month'|'12month')
--   시작일       -> start_date
--   종료일       -> end_date    (start_date + period; stored, not derived)
--   회원권 형태  -> type        ('free'|'session'|'class' = 자유이용권/세션권/예약권)
--   최대 횟수    -> max_visits  (세션권=계약 횟수, 예약권=횟수제, 무제한/자유이용권=null)

-- ============================================================
-- memberships table
-- ============================================================
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  cost integer not null default 0 check (cost >= 0),
  period text not null check (period in ('month', '3month', '6month', '12month')),
  start_date date not null,
  end_date date not null,
  type text not null check (type in ('free', 'session', 'class')),
  max_visits integer check (max_visits is null or max_visits > 0),
  created_at timestamptz not null default now()
);

create index if not exists memberships_user_id_idx on public.memberships (user_id);

-- ============================================================
-- RLS — own rows only (admin policies deferred per role strategy)
-- ============================================================
alter table public.memberships enable row level security;

drop policy if exists "memberships: read own" on public.memberships;
create policy "memberships: read own" on public.memberships
  for select using (auth.uid() = user_id);

drop policy if exists "memberships: insert own" on public.memberships;
create policy "memberships: insert own" on public.memberships
  for insert with check (auth.uid() = user_id);

drop policy if exists "memberships: update own" on public.memberships;
create policy "memberships: update own" on public.memberships
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "memberships: delete own" on public.memberships;
create policy "memberships: delete own" on public.memberships
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Seed (가데이터): attach to the test account = the first auth user.
-- Idempotent: skips if the test user already has memberships, or if no
-- user exists yet. Dates assume "today" ~ 2026-06-09 so the screen shows
-- a mix of active (2) and expired (1) cards.
-- ============================================================
do $$
declare
  test_user_id uuid;
begin
  select id into test_user_id from auth.users order by created_at asc limit 1;

  if test_user_id is null then
    raise notice 'memberships seed skipped: no auth.users row yet (create the test account first).';
    return;
  end if;

  if exists (select 1 from public.memberships where user_id = test_user_id) then
    raise notice 'memberships seed skipped: test user already has memberships.';
    return;
  end if;

  insert into public.memberships (user_id, name, cost, period, start_date, end_date, type, max_visits)
  values
    (test_user_id, '강남 PT 30회',   1800000, '6month', date '2026-04-01', date '2026-10-01', 'session', 30),
    (test_user_id, '요가 1개월권',     120000, 'month',  date '2026-06-01', date '2026-07-01', 'free',    null),
    (test_user_id, '필라테스 10회',    350000, '3month', date '2026-02-01', date '2026-05-01', 'class',   10);

  raise notice 'memberships seed inserted for user %', test_user_id;
end $$;


-- ████████████████████████████████████████████████████████████
-- 04_centers.sql
-- ████████████████████████████████████████████████████████████

-- centers table + RLS (owner-only). Run AFTER 03_memberships.sql.
--
-- Doc -> column mapping:
--   센터명   -> name
--   주소     -> address
--   위도     -> latitude   (numeric(10,8), -90~90)
--   경도     -> longitude  (numeric(11,8), -180~180)
-- membership_id links the center to its membership (STEP 3 onboarding).

create table if not exists public.centers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  name text not null,
  address text,
  latitude numeric(10, 8) check (latitude is null or latitude between -90 and 90),
  longitude numeric(11, 8) check (longitude is null or longitude between -180 and 180),
  created_at timestamptz not null default now()
);

create index if not exists centers_user_id_idx on public.centers (user_id);
create index if not exists centers_membership_id_idx on public.centers (membership_id);

alter table public.centers enable row level security;

drop policy if exists "centers: read own" on public.centers;
create policy "centers: read own" on public.centers
  for select using (auth.uid() = user_id);

drop policy if exists "centers: insert own" on public.centers;
create policy "centers: insert own" on public.centers
  for insert with check (auth.uid() = user_id);

drop policy if exists "centers: update own" on public.centers;
create policy "centers: update own" on public.centers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "centers: delete own" on public.centers;
create policy "centers: delete own" on public.centers
  for delete using (auth.uid() = user_id);


-- ████████████████████████████████████████████████████████████
-- 05_visits.sql
-- ████████████████████████████████████████████████████████████

-- visits table + RLS (owner-only). Run AFTER 04_centers.sql.
--
-- Doc -> column mapping:
--   체크인 시각      -> check_in_time
--   체크아웃 시각    -> check_out_time         (선택)
--   총 운동 시간(분) -> total_exercise_minutes (선택)
--   기분             -> mood   ('good'|'normal'|'tired' = 좋음/보통/피곤)
--   메모             -> notes
--   상태             -> status ('checked_in' 기본)

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  center_name text,
  check_in_time timestamptz not null default now(),
  check_out_time timestamptz,
  total_exercise_minutes integer check (total_exercise_minutes is null or total_exercise_minutes >= 0),
  mood text check (mood is null or mood in ('good', 'normal', 'tired')),
  notes text,
  status text not null default 'checked_in',
  created_at timestamptz not null default now()
);

create index if not exists visits_user_id_idx on public.visits (user_id);
create index if not exists visits_membership_id_idx on public.visits (membership_id);

alter table public.visits enable row level security;

drop policy if exists "visits: read own" on public.visits;
create policy "visits: read own" on public.visits
  for select using (auth.uid() = user_id);

drop policy if exists "visits: insert own" on public.visits;
create policy "visits: insert own" on public.visits
  for insert with check (auth.uid() = user_id);

drop policy if exists "visits: update own" on public.visits;
create policy "visits: update own" on public.visits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "visits: delete own" on public.visits;
create policy "visits: delete own" on public.visits
  for delete using (auth.uid() = user_id);


-- ████████████████████████████████████████████████████████████
-- 06_exercise_records.sql
-- ████████████████████████████████████████████████████████████

-- exercise_records table + RLS (owner-only). Run AFTER 05_visits.sql.
--
-- Doc -> column mapping:
--   운동 부위   -> exercise_part  (가슴/등/다리/전신 …)
--   강도        -> intensity      ('easy'|'normal'|'hard' = 쉬움/보통/힘듦)
--   운동 시간   -> duration       (분, 선택)
--   메모        -> notes
--   자동 데이터 -> auto_data jsonb { distance, calories, speed, source }
--                  source: 'manual' | 'ocr'
--   기록 시각   -> recorded_at

create table if not exists public.exercise_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  exercise_part text not null,
  intensity text check (intensity is null or intensity in ('easy', 'normal', 'hard')),
  duration integer check (duration is null or duration >= 0),
  notes text,
  auto_data jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists exercise_records_user_id_idx on public.exercise_records (user_id);
create index if not exists exercise_records_visit_id_idx on public.exercise_records (visit_id);

alter table public.exercise_records enable row level security;

drop policy if exists "exercise_records: read own" on public.exercise_records;
create policy "exercise_records: read own" on public.exercise_records
  for select using (auth.uid() = user_id);

drop policy if exists "exercise_records: insert own" on public.exercise_records;
create policy "exercise_records: insert own" on public.exercise_records
  for insert with check (auth.uid() = user_id);

drop policy if exists "exercise_records: update own" on public.exercise_records;
create policy "exercise_records: update own" on public.exercise_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "exercise_records: delete own" on public.exercise_records;
create policy "exercise_records: delete own" on public.exercise_records
  for delete using (auth.uid() = user_id);


-- ████████████████████████████████████████████████████████████
-- 07_user_preferences.sql
-- ████████████████████████████████████████████████████████████

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
