-- 21_memberships_type_v2.sql
-- '회원권 활용도' 화면 명세 v1.1 (시나리오 C) — 회원권 도메인 전반 개편의 토대.
--   · type 2종화: 'session'(인세권) / 'period'(기간권)   (기존 free/session/class 3종 → 2종)
--   · weekly_goal: 기간권 주당 목표 방문 (회당 가치·목표 회수 환산의 분모)
--   · input_method: 등록 출처(manual/receipt_scan) — 데이터 신뢰도 구분
-- 멱등(idempotent): 반복 실행 안전.

-- 1) 옛 제약 먼저 제거 (있어야 type 값을 새 값으로 바꿀 수 있음)
alter table public.memberships drop constraint if exists memberships_type_check;
alter table public.memberships drop constraint if exists memberships_type_check_v2;

-- 2) 데이터 이전 (3종 → 2종)
update public.memberships set type = 'period'  where type = 'free';
update public.memberships set type = 'session' where type = 'class' and max_visits is not null;
update public.memberships set type = 'period'  where type = 'class' and max_visits is null;

-- 3) 새 제약 추가 (session/period)
alter table public.memberships add constraint memberships_type_check_v2 check (type in ('session', 'period'));

-- 4) 기간권 주당 목표 방문 (PERIOD 전용, nullable)
alter table public.memberships add column if not exists weekly_goal integer
  check (weekly_goal is null or weekly_goal > 0);

-- 5) 입력 출처
alter table public.memberships add column if not exists input_method text
  check (input_method is null or input_method in ('manual', 'receipt_scan'));
