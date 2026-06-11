-- workout_logs: 운동 완료 기록
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  routine_title text not null,
  routine_meta text not null,
  duration_min int not null,
  exercise_count int not null,
  difficulty text not null check (difficulty in ('easy', 'good', 'hard')),
  pain_areas text[] not null default '{}',
  completion_status text not null check (completion_status in ('completed', 'partial', 'missed')),
  memo text,
  ai_feedback jsonb,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.workout_logs enable row level security;

-- 본인 기록만 읽기/쓰기
create policy "workout_logs: own read"
  on public.workout_logs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "workout_logs: own insert"
  on public.workout_logs for insert
  to authenticated
  with check (auth.uid() = user_id);
