-- 33_analytics_views.sql
-- 사업/관리 지표 뷰. 전용 스키마 analytics(= PostgREST 기본 노출 X → 클라이언트로 새지 않음).
-- Metabase/SQL 직접 연결(읽기 전용 롤)에서 조회. 멱등(create or replace).

create schema if not exists analytics;

-- 1) 활성화 퍼널(베타 NSM) — 사용자별 단계 도달.
--    온보딩=profiles.onboarded, 회원권/핵심행동=도메인 테이블(이벤트 적재 이전 사용자도 포함).
create or replace view analytics.v_user_activation as
select
  u.id as user_id,
  coalesce(p.onboarded, false) as onboarded,
  exists (select 1 from public.memberships m where m.user_id = u.id) as has_membership,
  (
    exists (select 1 from public.visits v where v.user_id = u.id)
    or exists (select 1 from public.schedules s where s.user_id = u.id)
    or exists (select 1 from public.meals me where me.user_id = u.id)
    or exists (select 1 from public.workout_logs w where w.user_id = u.id)
  ) as did_core_action,
  exists (select 1 from public.visits v where v.user_id = u.id and v.verify_status = 'verified') as did_verified_checkin
from auth.users u
left join public.profiles p on p.id = u.id;

-- 1-요약) 인원수 퍼널(n/total). 베타(≤5명)에서 바로 4/5 확인용.
create or replace view analytics.v_activation_summary as
select
  count(*) as total_users,
  count(*) filter (where onboarded) as onboarded,
  count(*) filter (where has_membership) as with_membership,
  count(*) filter (where did_core_action) as core_action,
  count(*) filter (where did_verified_checkin) as verified_checkin
from analytics.v_user_activation;

-- 2) 주간 검증 체크인(출시 NSM) — 주별 검증 체크인 수 + 활성 사용자.
create or replace view analytics.v_weekly_verified_checkins as
select
  date_trunc('week', check_in_time) as week,
  count(*) as verified_checkins,
  count(distinct user_id) as active_users
from public.visits
where verify_status = 'verified'
group by 1
order by 1;

-- 3) 회원권 활용도/회수액 — 회원권별 검증 방문·회수액·회수율(원금 대비).
create or replace view analytics.v_membership_utilization as
select
  m.id as membership_id,
  m.user_id,
  m.type,
  m.cost,
  count(v.id) filter (where v.verify_status = 'verified') as verified_visits,
  coalesce(sum(v.recovered_amount), 0) as recovered,
  round(coalesce(sum(v.recovered_amount), 0)::numeric / nullif(m.cost, 0) * 100, 1) as recovery_pct,
  m.end_date,
  (m.end_date < now()::date) as expired
from public.memberships m
left join public.visits v on v.membership_id = m.id
group by m.id;

-- 4) 가입 코호트(주별) — 가입 수 + 방문 경험 비율.
create or replace view analytics.v_weekly_cohort as
select
  date_trunc('week', p.created_at) as cohort_week,
  count(*) as signups,
  count(*) filter (where exists (select 1 from public.visits v where v.user_id = p.id)) as ever_visited
from public.profiles p
group by 1
order by 1;
