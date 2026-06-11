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
