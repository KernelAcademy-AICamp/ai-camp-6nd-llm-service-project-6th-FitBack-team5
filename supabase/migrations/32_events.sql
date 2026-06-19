-- 32_events.sql
-- 제품 이벤트 트래킹 — 계정 단위 퍼널/지표(NSM=주간 검증 체크인 등) 측정용.
--   name   : 이벤트 이름(signup / checkin_verified / schedule_added …)
--   props  : 이벤트별 상세(jsonb)
--   platform: web / ios / android
-- RLS owner-only(insert/select). 집계 분석은 서버(직접 SQL)에서 수행.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  props jsonb,
  platform text,
  created_at timestamptz not null default now()
);

create index if not exists events_name_created_idx on public.events (name, created_at);
create index if not exists events_user_created_idx on public.events (user_id, created_at);

alter table public.events enable row level security;

drop policy if exists "events: read own" on public.events;
create policy "events: read own" on public.events
  for select using (auth.uid() = user_id);

drop policy if exists "events: insert own" on public.events;
create policy "events: insert own" on public.events
  for insert with check (auth.uid() = user_id);
