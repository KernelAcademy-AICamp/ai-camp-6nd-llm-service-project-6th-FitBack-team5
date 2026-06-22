-- ============================================================
-- 34_workout_custom.sql
-- "오늘 운동 커스텀" (워크아웃 챗봇 → 커스텀 루틴) 전용 도메인.
--
-- 두 테이블:
--   (1) workout_custom_catalog  — 부위×유형별 선택 가능한 종목 마스터.
--   (2) workout_sessions        — 한 번의 오운완 흐름(선택→루틴→기록).
--
-- 'exercises' 테이블과 분리한 이유:
--  - exercises 는 AI 코치 루틴/TTS 큐 용도라 컬럼·시드 정책이 달라서,
--    커스텀 UI에 노출할 6/4개 큐레이션을 깔끔히 분리한다.
-- ============================================================

-- ------------------------------------------------------------
-- (1) 카탈로그
-- ------------------------------------------------------------
create table if not exists public.workout_custom_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body_part text not null check (body_part in ('하체','상체','코어','전신')),
  exercise_type text not null check (exercise_type in ('근력','유산소','스트레칭')),
  unit text not null default '회' check (unit in ('회','초')),
  default_sets int not null default 3,
  default_reps int not null default 12,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (body_part, exercise_type, name)
);

create index if not exists workout_custom_catalog_lookup
  on public.workout_custom_catalog (body_part, exercise_type, sort_order);

alter table public.workout_custom_catalog enable row level security;

drop policy if exists "catalog readable by authenticated"
  on public.workout_custom_catalog;
create policy "catalog readable by authenticated"
  on public.workout_custom_catalog for select to authenticated using (true);

-- ------------------------------------------------------------
-- (2) 세션 (오운완 1건)
-- items JSONB: [{ catalog_id, name, unit, duration_min, sets, reps, done }]
-- success_flag: null = 진행중, 'Y' = 완료, 'N' = 실패(자정 넘김)
-- ------------------------------------------------------------
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  body_part text not null,
  exercise_type text not null,
  total_duration_min int not null default 60,
  items jsonb not null default '[]'::jsonb,
  memo text,
  success_flag text check (success_flag in ('Y','N')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists workout_sessions_user_active
  on public.workout_sessions (user_id, success_flag, started_at desc);

alter table public.workout_sessions enable row level security;

drop policy if exists "sessions: own read" on public.workout_sessions;
create policy "sessions: own read"
  on public.workout_sessions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "sessions: own insert" on public.workout_sessions;
create policy "sessions: own insert"
  on public.workout_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "sessions: own update" on public.workout_sessions;
create policy "sessions: own update"
  on public.workout_sessions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
