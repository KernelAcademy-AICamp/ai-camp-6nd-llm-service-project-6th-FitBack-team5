-- 26_schedules.sql
-- 일정 캘린더 — 예정 일정 저장(AI 추천/수동 입력). 과거 기록(visits/workout_logs/meals)과 별개.
--   type   : diet / workout / visit / custom
--   source : ai(코치 추천) / manual(직접 입력)
--   status : planned(예정) / done(완료) / skipped(건너뜀)
--   payload: 타입별 상세(jsonb) — 예) 식단 메뉴/끼니, 운동 루틴 요약, 메모
-- RLS owner-only. 멱등.

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  type text not null check (type in ('diet', 'workout', 'visit', 'custom')),
  title text not null,
  payload jsonb,
  source text not null default 'manual' check (source in ('ai', 'manual')),
  status text not null default 'planned' check (status in ('planned', 'done', 'skipped')),
  created_at timestamptz not null default now()
);

create index if not exists schedules_user_date_idx on public.schedules (user_id, date);

alter table public.schedules enable row level security;

drop policy if exists "schedules: read own" on public.schedules;
create policy "schedules: read own" on public.schedules
  for select using (auth.uid() = user_id);

drop policy if exists "schedules: insert own" on public.schedules;
create policy "schedules: insert own" on public.schedules
  for insert with check (auth.uid() = user_id);

drop policy if exists "schedules: update own" on public.schedules;
create policy "schedules: update own" on public.schedules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "schedules: delete own" on public.schedules;
create policy "schedules: delete own" on public.schedules
  for delete using (auth.uid() = user_id);
