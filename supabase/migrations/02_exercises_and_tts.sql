-- ============================================================
-- 02_exercises_and_tts.sql
-- 운동 마스터 + 오디오 캐시 구조.
-- 텍스트 저장과 오디오 파일 캐싱을 분리해서 설계.
-- ============================================================

-- updated_at 자동 갱신 유틸 (재사용 가능)
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- exercises: 운동 마스터 (텍스트 + 오디오 캐시 url)
-- ------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  muscle_group text,
  description_text text not null,
  description_audio_url text,
  caution_text text not null default '',
  caution_audio_url text,
  tts_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists exercises_updated_at on public.exercises;
create trigger exercises_updated_at
  before update on public.exercises
  for each row execute function public.update_updated_at();

-- ------------------------------------------------------------
-- exercise_cues: 구간 큐 (세트 시작 / rep / rest / finish) 템플릿 + 캐시
-- 파라미터 고정값은 params jsonb로, 미리 생성된 오디오는 audio_url로.
-- ------------------------------------------------------------
create table if not exists public.exercise_cues (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid references public.exercises(id) on delete cascade,
  cue_type text not null check (cue_type in ('set_start', 'rep_count', 'rest', 'finish')),
  template text not null,
  params jsonb not null default '{}'::jsonb,
  audio_url text,
  tts_version int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists exercise_cues_lookup
  on public.exercise_cues (cue_type, exercise_id);

-- ------------------------------------------------------------
-- tts_cache: 동적 생성 TTS 캐시 (텍스트 해시 → 오디오 url)
-- text_hash = sha256(text || ':' || tts_version)
-- ------------------------------------------------------------
create table if not exists public.tts_cache (
  text_hash text primary key,
  text text not null,
  audio_url text not null,
  tts_version int not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists tts_cache_last_used on public.tts_cache (last_used_at);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.exercises enable row level security;
alter table public.exercise_cues enable row level security;
alter table public.tts_cache enable row level security;

-- 인증된 사용자: 모든 테이블 읽기 가능
drop policy if exists "exercises readable by authenticated" on public.exercises;
create policy "exercises readable by authenticated"
  on public.exercises for select to authenticated using (true);

drop policy if exists "exercise_cues readable by authenticated" on public.exercise_cues;
create policy "exercise_cues readable by authenticated"
  on public.exercise_cues for select to authenticated using (true);

drop policy if exists "tts_cache readable by authenticated" on public.tts_cache;
create policy "tts_cache readable by authenticated"
  on public.tts_cache for select to authenticated using (true);

-- 1단계: 클라이언트에서 exercises upsert 허용 (운동 마스터 자동 영속화).
-- TODO Phase 2: Edge Function 경유로 전환 시 아래 정책 제거.
drop policy if exists "exercises insertable by authenticated" on public.exercises;
create policy "exercises insertable by authenticated"
  on public.exercises for insert to authenticated with check (true);

drop policy if exists "exercises updatable by authenticated" on public.exercises;
create policy "exercises updatable by authenticated"
  on public.exercises for update to authenticated using (true) with check (true);

-- exercise_cues / tts_cache 는 1단계에선 write 안 함.
-- (클라우드 TTS 도입 시 Edge Function 또는 백오피스 경유)
