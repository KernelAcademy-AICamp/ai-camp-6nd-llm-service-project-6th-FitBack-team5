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
-- 시드(데모 데이터)는 여기서 넣지 않습니다.
-- 08_seed_demo_data.sql 이 전 테이블(memberships 포함)을 한 번에 채웁니다:
--   seed_demo_data_for_user() 함수 + 신규 계정 자동 트리거 + 기존 계정 백필.
-- ============================================================


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


-- ████████████████████████████████████████████████████████████
-- 08_seed_demo_data.sql
-- ████████████████████████████████████████████████████████████

-- 08_seed_demo_data.sql — 전 테이블 데모(가) 데이터. Run AFTER 07_user_preferences.sql.
--
-- 함수 seed_demo_data_for_user(uid) 하나로 6개 테이블을 FK 관계까지 일관되게 채우고,
-- 이를 (a) 신규 계정 자동 트리거 + (b) 기존 계정 백필 에 재사용합니다.
--   memberships → centers/visits (membership FK) → exercise_records (visit FK)
--
-- ⚠️ 개발용입니다. 프로덕션 전환 시 자동 트리거(on_auth_user_created_demo_seed)를 제거하세요.
--    (실제 가입자에게 가짜 데이터가 들어가면 안 되므로)

-- ============================================================
-- 한 유저에 전 테이블 데모 데이터 (계정별 멱등: 이미 회원권 있으면 skip)
-- security definer: 신규 계정 트리거 컨텍스트에서도 RLS 우회해 insert.
-- ============================================================
create or replace function public.seed_demo_data_for_user(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m_pt uuid;
  m_yoga uuid;
  m_pilates uuid;
  v_id uuid;
begin
  -- 이미 시드된 계정이면 아무것도 하지 않음 (중복 방지)
  if exists (select 1 from public.memberships where user_id = uid) then
    return;
  end if;

  -- 1) profiles — 건강·기본 정보 (행 자체는 handle_new_user 트리거가 이미 생성)
  update public.profiles set
    age = 28,
    gender = 'M',
    height = 175,
    weight = 72.5,
    exercise_level = 'intermediate',
    injury_history = '오른쪽 어깨 회전근개 경미 (2024)',
    medical_conditions = null,
    avoid_exercise_parts = array['shoulder']
  where id = uid;

  -- 2) memberships — 3건 (기준일 ~2026-06-09: 사용중 2 + 만료 1)
  insert into public.memberships (user_id, name, cost, period, start_date, end_date, type, max_visits)
  values (uid, '강남 PT 30회', 1800000, '6month', date '2026-04-01', date '2026-10-01', 'session', 30)
  returning id into m_pt;

  insert into public.memberships (user_id, name, cost, period, start_date, end_date, type, max_visits)
  values (uid, '요가 1개월권', 120000, 'month', date '2026-06-01', date '2026-07-01', 'free', null)
  returning id into m_yoga;

  insert into public.memberships (user_id, name, cost, period, start_date, end_date, type, max_visits)
  values (uid, '필라테스 10회', 350000, '3month', date '2026-02-01', date '2026-05-01', 'class', 10)
  returning id into m_pilates;

  -- 3) centers — membership 별 센터 (GPS: 서울 강남 일대 예시)
  insert into public.centers (user_id, membership_id, name, address, latitude, longitude) values
    (uid, m_pt,      '강남 피트니스',        '서울 강남구 테헤란로 123', 37.50120000, 127.03680000),
    (uid, m_yoga,    '요가 스튜디오 압구정', '서울 강남구 압구정로 45',  37.52700000, 127.02850000),
    (uid, m_pilates, '코어 필라테스 선릉',   '서울 강남구 선릉로 200',   37.50450000, 127.04900000);

  -- 4) visits + 5) exercise_records — 방문마다 운동 기록 연결
  -- PT 방문 #1 (하체)
  insert into public.visits (user_id, membership_id, center_name, check_in_time, check_out_time, total_exercise_minutes, mood, notes, status)
  values (uid, m_pt, '강남 피트니스', timestamptz '2026-06-01 19:00+09', timestamptz '2026-06-01 20:10+09', 70, 'good', '하체 집중', 'checked_in')
  returning id into v_id;
  insert into public.exercise_records (user_id, visit_id, exercise_part, intensity, duration, notes, auto_data) values
    (uid, v_id, 'legs', 'hard',   40, '스쿼트 5x5, 레그프레스 4세트', null),
    (uid, v_id, 'core', 'normal', 20, '플랭크 3세트, 행잉레그레이즈', null);

  -- PT 방문 #2 (상체 + 유산소, OCR 자동데이터 예시)
  insert into public.visits (user_id, membership_id, center_name, check_in_time, check_out_time, total_exercise_minutes, mood, notes, status)
  values (uid, m_pt, '강남 피트니스', timestamptz '2026-06-04 18:30+09', timestamptz '2026-06-04 19:40+09', 70, 'normal', '상체 + 가벼운 유산소', 'checked_in')
  returning id into v_id;
  insert into public.exercise_records (user_id, visit_id, exercise_part, intensity, duration, notes, auto_data) values
    (uid, v_id, 'chest',  'normal', 35, '벤치프레스, 인클라인 덤벨', null),
    (uid, v_id, 'cardio', 'easy',   20, '트레드밀 (러닝머신 OCR)', '{"distance": 3.2, "calories": 240, "speed": 9.6, "source": "ocr"}'::jsonb);

  -- 요가 방문 #1 (전신)
  insert into public.visits (user_id, membership_id, center_name, check_in_time, check_out_time, total_exercise_minutes, mood, notes, status)
  values (uid, m_yoga, '요가 스튜디오 압구정', timestamptz '2026-06-06 07:00+09', timestamptz '2026-06-06 08:00+09', 60, 'good', '아침 빈야사', 'checked_in')
  returning id into v_id;
  insert into public.exercise_records (user_id, visit_id, exercise_part, intensity, duration, notes, auto_data) values
    (uid, v_id, 'fullbody', 'easy', 60, '빈야사 플로우', null);

  -- 6) user_preferences — Phase 2 (구조만 활성). 데모 1건.
  insert into public.user_preferences (user_id, preferred_exercise_times, preferred_exercise_parts, fitness_goal)
  values (uid, array['06:00-08:00', '18:00-20:00'], array['chest', 'back', 'legs'], 'muscle_gain')
  on conflict (user_id) do nothing;
end;
$$;

-- ============================================================
-- 신규 계정 자동 시드 트리거 (개발용)
-- profile 생성(on_auth_user_created) 직후 실행되도록 트리거 이름을 잡았습니다.
-- 시드 실패가 회원가입을 막지 않도록 예외를 흡수합니다.
-- ⚠️ 프로덕션 전 이 트리거를 제거하세요.
-- ============================================================
create or replace function public.handle_new_user_demo_seed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.seed_demo_data_for_user(new.id);
  exception when others then
    raise warning 'demo seed skipped for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_demo_seed on auth.users;
create trigger on_auth_user_created_demo_seed
  after insert on auth.users
  for each row execute function public.handle_new_user_demo_seed();

-- ============================================================
-- 기존 모든 계정 백필 (개발용 리셋)
-- ⚠️ 각 계정의 기존 memberships(+cascade로 centers/visits/exercise_records)와
--    user_preferences 를 지우고 데모 데이터를 새로 만듭니다.
--    수동으로 넣은 데이터가 있으면 사라지니, 개발 환경에서만 실행하세요.
-- ============================================================
do $$
declare
  u record;
  n integer := 0;
begin
  for u in select id from auth.users loop
    delete from public.memberships where user_id = u.id;       -- cascade: centers/visits/exercise_records
    delete from public.user_preferences where user_id = u.id;  -- membership FK가 아니라 별도 삭제
    perform public.seed_demo_data_for_user(u.id);
    n := n + 1;
  end loop;
  raise notice 'demo seed: reset + seeded % account(s).', n;
end $$;


-- ████████████████████████████████████████████████████████████
-- 09_disable_demo_seed_trigger.sql
-- ████████████████████████████████████████████████████████████

-- 09_disable_demo_seed_trigger.sql — 온보딩에서 회원권을 직접 등록하므로,
-- 08의 "신규 계정 자동 시드 트리거"를 비활성화합니다.
-- Run AFTER 08. 기존 DB에는 이 파일만 SQL Editor에서 Run 하면 트리거가 제거됩니다.
--
-- seed_demo_data_for_user() 함수와 백필 결과는 그대로 둡니다(개발용 수동 시드에 사용).
-- 다시 켜려면 08의 create trigger 블록을 재실행하세요.

drop trigger if exists on_auth_user_created_demo_seed on auth.users;


-- ████████████████████████████████████████████████████████████
-- 10_backfill_centers.sql
-- ████████████████████████████████████████████████████████████

-- 10_backfill_centers.sql — 센터(좌표) 없는 회원권에 기본 좌표 보정 (개발/테스트용).
-- Run AFTER 09. GPS 도착·날씨·경로는 센터 좌표가 있어야 동작하는데, 온보딩으로
-- 등록한 회원권 중 좌표를 안 넣은 것은 센터가 없다. 그런 회원권에 기본 좌표(강남역)를
-- 채운다. 멱등: 이미 센터가 있는 회원권은 건너뛴다.
--
-- ※ 이후 회원권 등록 시 '현재 위치를 센터로' 버튼으로 좌표를 넣으면 이 보정은 불필요.

insert into public.centers (user_id, membership_id, name, latitude, longitude)
select m.user_id, m.id, m.name, 37.49794500, 127.02758100
from public.memberships m
where not exists (
  select 1 from public.centers c where c.membership_id = m.id
);
