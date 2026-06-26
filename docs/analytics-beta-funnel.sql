-- ============================================================
-- FitBack 베타 퍼널 분석 (PRD v0.4 §06 기준)
-- 실행: Supabase Dashboard → SQL Editor → 아래 "쿼리 블록"을 하나씩
--       드래그 선택 후 Run(⌘↵). (한꺼번에 Run하면 Results엔 마지막 결과만 표시)
-- 소스: public.events (user_id · name · props · platform · created_at)
-- Role: postgres (RLS 우회 → 전체 사용자 조회). Source: Primary Database.
--
-- ⚠️ 사용 전 확인
--   1) 아래 날짜('2026-06-26' ~ '2026-06-29')를 실제 베타 기간으로 수정.
--   2) onboarding_complete · checkin_started 는 신규 추가분 → 그 코드가 들어간
--      빌드(APK/웹)로 테스트해야 집계됨(이전 배포본엔 안 잡힘).
--   3) 데모/테스트 계정 오염 시 기간 필터(필수) + 필요하면 user_id 화이트리스트.
-- ============================================================


-- [0] 헬스체크 — 이벤트가 들어오고 있는가?
select
  count(*)               as 총건수,
  count(distinct user_id) as 사용자수,
  max(created_at)        as 최근발생
from events;


-- [1] 퍼널 단계별 "도달 인원수" (비율 아님, n=5 기준)
select
  count(distinct user_id) filter (where name = 'signup')              as 가입,
  count(distinct user_id) filter (where name = 'onboarding_complete') as 온보딩완료,
  count(distinct user_id) filter (where name = 'membership_added')    as 회원권등록,
  count(distinct user_id) filter (where name in
    ('checkin_started','recommend_click','schedule_added','diet_logged','workout_completed'))
                                                                      as 첫핵심행동,
  count(distinct user_id) filter (where name = 'coach_open')          as 코치1회,
  count(distinct user_id) filter (where name = 'checkin_verified')    as 검증체크인
from events
where created_at >= '2026-06-26' and created_at < '2026-06-29';


-- [2] 사용자별 도달 매트릭스 (n≤5 — 누가 어디서 막혔나)
select
  user_id,
  bool_or(name = 'signup')              as 가입,
  bool_or(name = 'onboarding_complete') as 온보딩,
  bool_or(name = 'membership_added')    as 회원권,
  bool_or(name in ('checkin_started','recommend_click','schedule_added','diet_logged','workout_completed'))
                                        as 첫핵심행동,
  bool_or(name = 'coach_open')          as 코치,
  bool_or(name = 'checkin_verified')    as 검증체크인
from events
where created_at >= '2026-06-26' and created_at < '2026-06-29'
group by user_id
order by user_id;


-- [3] 베타 NSM 단일 숫자 — 첫 핵심 행동 도달 인원 (목표 ≥ 4/5)
select count(distinct user_id) as nsm_첫핵심행동_도달인원
from events
where name in ('checkin_started','recommend_click','schedule_added','diet_logged','workout_completed')
  and created_at >= '2026-06-26' and created_at < '2026-06-29';


-- [4] 플랫폼별·일자별 원본 점검
select date(created_at) as 날짜, platform, name, count(*) as 건수
from events
where created_at >= '2026-06-26' and created_at < '2026-06-29'
group by 1, 2, 3
order by 1, 2, 3;


-- ============================================================
-- (진단 보조) 퍼널 마일스톤은 아니지만 품질 점검용
-- ============================================================

-- [D1] 체크인 품질 — 시도 / 검증 / 수동(fallback) 분해
select
  count(*) filter (where name = 'checkin_started')  as 체크인_시도,
  count(*) filter (where name = 'checkin_verified') as 검증_성공,
  count(*) filter (where name = 'checkin_fallback') as 수동_출석
from events
where created_at >= '2026-06-26' and created_at < '2026-06-29';

-- [D2] 첫 핵심 행동을 경로별로 분해 (어떤 가치로 활성화됐나)
select name, count(distinct user_id) as 도달인원
from events
where name in ('checkin_started','recommend_click','schedule_added','diet_logged','workout_completed')
  and created_at >= '2026-06-26' and created_at < '2026-06-29'
group by name
order by 도달인원 desc;
