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
