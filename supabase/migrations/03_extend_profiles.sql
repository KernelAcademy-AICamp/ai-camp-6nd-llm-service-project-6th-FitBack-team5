-- Extend profiles with the User health/basic fields from the Phase 1 type doc.
-- Maps the doc's "users" entity onto the existing public.profiles table
-- (profiles.id == auth.users.id, 1:1). Run AFTER 01_init_profiles.sql.
--
-- Doc -> column mapping:
--   이름            -> display_name (already exists)
--   나이            -> age                  (만 나이, integer)
--   성별            -> gender               ('M' | 'F')
--   키 (cm)         -> height               (cm, 100~250)
--   몸무게 (kg)     -> weight               (kg, 20~300, 소수 허용)
--   운동경험        -> exercise_level       ('beginner'|'intermediate'|'advanced' = 초보/중급/고급)
--   부상이력        -> injury_history       (자유 텍스트, 선택)
--   건강 제약사항   -> medical_conditions   (자유 텍스트, 선택)
--   피해야 할 부위  -> avoid_exercise_parts (text[], 다중선택)
-- All columns are nullable: onboarding STEP 2 fills them in after login.

alter table public.profiles
  add column if not exists age integer,
  add column if not exists gender text,
  add column if not exists height numeric(5, 2),
  add column if not exists weight numeric(5, 2),
  add column if not exists exercise_level text,
  add column if not exists injury_history text,
  add column if not exists medical_conditions text,
  add column if not exists avoid_exercise_parts text[];

-- Range / enum checks (guarded so re-running is a no-op).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_age_check') then
    alter table public.profiles
      add constraint profiles_age_check check (age is null or age between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_gender_check') then
    alter table public.profiles
      add constraint profiles_gender_check check (gender is null or gender in ('M', 'F'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_height_check') then
    alter table public.profiles
      add constraint profiles_height_check check (height is null or height between 100 and 250);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_weight_check') then
    alter table public.profiles
      add constraint profiles_weight_check check (weight is null or weight between 20 and 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_exercise_level_check') then
    alter table public.profiles
      add constraint profiles_exercise_level_check
      check (exercise_level is null or exercise_level in ('beginner', 'intermediate', 'advanced'));
  end if;
end $$;
