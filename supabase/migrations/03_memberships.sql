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
