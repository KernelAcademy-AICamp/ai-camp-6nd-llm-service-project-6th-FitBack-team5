-- ============================================================
-- 36_workout_custom_images.sql
-- 종목 카탈로그에 slug + image_path 추가 + Storage 버킷 생성.
--
-- 폴더 구조:
--   workout-custom-exercise/lower/<slug>.png   (하체)
--   workout-custom-exercise/upper/<slug>.png   (상체)
--   workout-custom-exercise/core/<slug>.png    (코어)
--   workout-custom-exercise/full/<slug>.png    (전신)
--
-- 앱은 image_path 만 읽고, supabase.storage.from(bucket).getPublicUrl(path)
-- 로 런타임에 public URL 을 구성한다. (프로젝트 URL 하드코딩 회피)
-- ============================================================

-- ------------------------------------------------------------
-- 컬럼 추가
-- ------------------------------------------------------------
alter table public.workout_custom_catalog
  add column if not exists slug text,
  add column if not exists image_path text;

-- ------------------------------------------------------------
-- Storage 버킷 생성 (public)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('workout-custom-exercise', 'workout-custom-exercise', true)
  on conflict (id) do nothing;

-- 공개 읽기 정책 (anon + authenticated 모두 SELECT 가능)
drop policy if exists "wcx public read"
  on storage.objects;
create policy "wcx public read"
  on storage.objects for select
  to public
  using (bucket_id = 'workout-custom-exercise');

-- 인증된 사용자 업로드 (Studio 사용자 / 운영용. 운영 정책 조정 시 변경)
drop policy if exists "wcx authenticated write"
  on storage.objects;
create policy "wcx authenticated write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'workout-custom-exercise');

-- ------------------------------------------------------------
-- slug + image_path 채우기 (종목명 기준)
-- ------------------------------------------------------------
update public.workout_custom_catalog set slug = v.slug, image_path = v.image_path
from (values
  -- 하체 / lower
  ('스쿼트',        'squat',          'lower/squat.png'),
  ('런지',          'lunge',          'lower/lunge.png'),
  ('레그 프레스',   'leg_press',      'lower/leg_press.png'),
  ('레그 익스텐션', 'leg_extension',  'lower/leg_extension.png'),
  ('레그 컬',       'leg_curl',       'lower/leg_curl.png'),
  ('카프 레이즈',   'calf_raise',     'lower/calf_raise.png'),
  ('트레드밀 인클라인 워킹', 'treadmill_incline', 'lower/treadmill_incline.png'),
  ('스텝밀',        'stepmill',       'lower/stepmill.png'),
  ('사이클',        'cycle',          'lower/cycle.png'),
  ('로잉 머신',     'rowing_machine', 'lower/rowing_machine.png'),
  ('햄스트링 스트레칭',  'hamstring_stretch',   'lower/hamstring_stretch.png'),
  ('카프 스트레칭',      'calf_stretch',        'lower/calf_stretch.png'),
  ('힙 플렉서 스트레칭', 'hip_flexor_stretch',  'lower/hip_flexor_stretch.png'),
  ('쿼드 스트레칭',      'quad_stretch',        'lower/quad_stretch.png'),

  -- 상체 / upper
  ('벤치 프레스',         'bench_press',      'upper/bench_press.png'),
  ('랫풀다운',            'lat_pulldown',     'upper/lat_pulldown.png'),
  ('시티드 로우',         'seated_row',       'upper/seated_row.png'),
  ('숄더 프레스',         'shoulder_press',   'upper/shoulder_press.png'),
  ('체스트 플라이',       'chest_fly',        'upper/chest_fly.png'),
  ('트라이셉 익스텐션',   'tricep_extension', 'upper/tricep_extension.png'),
  ('상체 로잉 머신',      'upper_rowing',     'upper/upper_rowing.png'),
  ('배틀 로프',           'battle_rope',      'upper/battle_rope.png'),
  ('어시스트 풀업',       'assist_pullup',    'upper/assist_pullup.png'),
  ('점핑잭',              'jumping_jack',     'upper/jumping_jack.png'),
  ('가슴 스트레칭',       'chest_stretch',    'upper/chest_stretch.png'),
  ('어깨 회전',           'shoulder_rotation','upper/shoulder_rotation.png'),
  ('삼두 스트레칭',       'tricep_stretch',   'upper/tricep_stretch.png'),
  ('광배 스트레칭',       'lat_stretch',      'upper/lat_stretch.png'),

  -- 코어 / core
  ('플랭크',              'plank',              'core/plank.png'),
  ('행잉 레그 레이즈',    'hanging_leg_raise',  'core/hanging_leg_raise.png'),
  ('케이블 크런치',       'cable_crunch',       'core/cable_crunch.png'),
  ('디클라인 싯업',       'decline_situp',      'core/decline_situp.png'),
  ('러시안 트위스트',     'russian_twist',      'core/russian_twist.png'),
  ('앱 휠 롤아웃',        'ab_wheel_rollout',   'core/ab_wheel_rollout.png'),
  ('마운틴 클라이머',     'mountain_climber',   'core/mountain_climber.png'),
  ('버피 (코어)',         'burpee_core',        'core/burpee_core.png'),
  ('박스 점프',           'box_jump',           'core/box_jump.png'),
  ('점프 로프',           'jump_rope',          'core/jump_rope.png'),
  ('코브라',              'cobra',              'core/cobra.png'),
  ('차일드 포즈',         'child_pose',         'core/child_pose.png'),
  ('캣카우',              'cat_cow',            'core/cat_cow.png'),
  ('시티드 트위스트',     'seated_twist',       'core/seated_twist.png'),

  -- 전신 / full
  ('데드리프트',          'deadlift',           'full/deadlift.png'),
  ('클린 앤 프레스',      'clean_and_press',    'full/clean_and_press.png'),
  ('케틀벨 스윙',         'kettlebell_swing',   'full/kettlebell_swing.png'),
  ('버피',                'burpee',             'full/burpee.png'),
  ('파머스 워크',         'farmers_walk',       'full/farmers_walk.png'),
  ('스내치',              'snatch',             'full/snatch.png'),
  ('트레드밀',            'treadmill',          'full/treadmill.png'),
  ('사이클 (전신)',       'cycle_full',         'full/cycle_full.png'),
  ('일립티컬',            'elliptical',         'full/elliptical.png'),
  ('점프 로프 (전신)',    'jump_rope_full',     'full/jump_rope_full.png'),
  ('다운독',              'downdog',            'full/downdog.png'),
  ('선 워리어',           'warrior',            'full/warrior.png'),
  ('척추 트위스트',       'spine_twist',        'full/spine_twist.png'),
  ('전신 폼롤링',         'full_foam_rolling',  'full/full_foam_rolling.png')
) as v(name, slug, image_path)
where public.workout_custom_catalog.name = v.name;

-- slug 유일성 보장 (이후 운영 추가시 보호막)
create unique index if not exists workout_custom_catalog_slug_key
  on public.workout_custom_catalog (slug);
