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
-- Seed (가데이터): give EVERY auth user the same 3 sample memberships.
-- Idempotent per account: an account that already has any membership is
-- skipped, so re-running only seeds newly-created accounts. Dates assume
-- "today" ~ 2026-06-09 so each account shows active (2) + expired (1).
-- ============================================================
do $$
declare
  u record;
  seeded integer := 0;
begin
  for u in select id from auth.users loop
    if exists (select 1 from public.memberships where user_id = u.id) then
      continue; -- already seeded for this account
    end if;

    insert into public.memberships (user_id, name, cost, period, start_date, end_date, type, max_visits)
    values
      (u.id, '강남 PT 30회',   1800000, '6month', date '2026-04-01', date '2026-10-01', 'session', 30),
      (u.id, '요가 1개월권',     120000, 'month',  date '2026-06-01', date '2026-07-01', 'free',    null),
      (u.id, '필라테스 10회',    350000, '3month', date '2026-02-01', date '2026-05-01', 'class',   10);

    seeded := seeded + 1;
  end loop;

  if seeded = 0 then
    raise notice 'memberships seed: nothing to do (no users yet, or all accounts already seeded).';
  else
    raise notice 'memberships seed: inserted 3 rows each for % account(s).', seeded;
  end if;
end $$;
