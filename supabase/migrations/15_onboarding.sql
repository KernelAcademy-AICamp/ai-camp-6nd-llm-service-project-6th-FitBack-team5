-- 12_onboarding.sql — 최초 로그인 온보딩.
--  · profiles.onboarded: 온보딩 완료 여부(첫 진입 위저드 노출 판단).
--    기존 회원권 보유 사용자는 완료로 간주해 재노출 방지(backfill).
--  · 운동 목표(fitness_goal)를 기획서 5종으로 확장:
--    근력(muscle_gain)/감량(fat_loss)/지구력(endurance) + 건강관리(health)/체형개선(body_shape)/습관형성(habit)
-- 멱등: add column if not exists / drop constraint if exists 재실행 안전.

alter table public.profiles add column if not exists onboarded boolean not null default false;

update public.profiles p
set onboarded = true
where p.onboarded = false
  and exists (select 1 from public.memberships m where m.user_id = p.id);

alter table public.user_preferences drop constraint if exists user_preferences_fitness_goal_check;
alter table public.user_preferences add constraint user_preferences_fitness_goal_check
  check (
    fitness_goal is null or fitness_goal in (
      'muscle_gain', 'fat_loss', 'endurance', 'health', 'body_shape', 'habit'
    )
  );
