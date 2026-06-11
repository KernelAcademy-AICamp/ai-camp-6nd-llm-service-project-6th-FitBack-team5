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
