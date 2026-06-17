-- ============================================================
-- 16_exercises_extend.sql
-- exercises 카탈로그를 추천 엔진의 후보 필터링·루틴 조립에 쓰기 위해
-- 메타데이터·기본값·코칭 큐 컬럼을 추가한다.
--
-- 기존 행은 LLM 자동 upsert로 쌓인 임시 데이터이므로 비운 뒤
-- 17_exercises_seed_100.sql 에서 카탈로그를 다시 채운다.
-- ============================================================

truncate table public.exercises restart identity cascade;

-- 의미 명확화: category(모호) → body_region('상체'/'하체'/'코어'/'전신'/'유연성')
alter table public.exercises
  rename column category to body_region;

alter table public.exercises
  -- 분류 축
  add column exercise_type text[] not null default '{}',           -- '유산소','근력','유연성','균형','복합'
  add column goal_tags text[] not null default '{}',               -- '체중 감량','체력 향상','자세 개선'
  add column place_tags text[] not null default '{}',              -- '집','야외','헬스장'
  add column phase_tags text[] not null default '{}',              -- 'warmup','main','cooldown'
  add column target_parts text[] not null default '{}',            -- 자극하는 부위
  add column contraindicated_parts text[] not null default '{}',   -- 이 부위가 불편하면 피해야 함
  add column equipment text[] not null default '{}',               -- 필요 장비 (빈 배열 = 맨몸)
  add column is_high_impact boolean not null default false,        -- 점프·뜀 동작 (집에서 층간소음)
  add column intensity int not null default 3,                     -- 1(매우 가벼움) ~ 5(매우 격렬)
  -- 세트 기반: 기본값·안전 범위
  add column default_sets int,
  add column default_reps int,
  add column min_reps int,
  add column max_reps int,
  -- 시간 기반: 기본값·안전 범위 (초)
  add column default_duration_sec int,
  add column min_duration_sec int,
  add column max_duration_sec int,
  -- 코칭 큐 (rep-scripts.ts / session.tsx가 그대로 소비)
  add column early_reps text[] not null default '{}',              -- 세트 기반: 초반 2개 ({count} 포함)
  add column middle_reps text[] not null default '{}',             -- 세트 기반: 중반 5개 generic 풀
  add column form_cues text[] not null default '{}',               -- 세트 기반: 운동 특화 폼 큐 2~3개 ({count} 포함)
                                                                   --   런타임에 middle_reps 슬롯 0/2/4 자리에 끼워 넣어 발화한다.
  add column final_reps text[] not null default '{}',              -- 세트 기반: 마지막 3개
  add column time_scripts text[] not null default '{}',            -- 시간 기반: 순차 cue (운동별 specific)
  add column halfway_encouragement text not null default '';       -- 시간 기반: 절반 시점 격려

alter table public.exercises
  add constraint exercises_intensity_range check (intensity between 1 and 5),
  -- 세트/시간 중 하나만 채워져야 함 (둘 다 비거나 둘 다 차면 무결성 위배)
  add constraint exercises_set_or_time check (
    (default_sets is not null and default_reps is not null and default_duration_sec is null)
    or
    (default_sets is null and default_reps is null and default_duration_sec is not null)
  );

-- 후보 필터링용 GIN 인덱스 (배열 contains/overlap 쿼리에 적합)
create index if not exists exercises_exercise_type_gin
  on public.exercises using gin (exercise_type);
create index if not exists exercises_goal_tags_gin
  on public.exercises using gin (goal_tags);
create index if not exists exercises_place_tags_gin
  on public.exercises using gin (place_tags);
create index if not exists exercises_phase_tags_gin
  on public.exercises using gin (phase_tags);
create index if not exists exercises_target_parts_gin
  on public.exercises using gin (target_parts);
create index if not exists exercises_contraindicated_parts_gin
  on public.exercises using gin (contraindicated_parts);
create index if not exists exercises_equipment_gin
  on public.exercises using gin (equipment);
create index if not exists exercises_intensity_idx
  on public.exercises (intensity);
-- form_cues 는 검색축이 아니라 페이로드라 인덱스 불필요.
