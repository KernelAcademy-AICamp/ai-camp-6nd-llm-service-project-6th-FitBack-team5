-- 11_exercise_records_by_type.sql — 운동기록을 회원권 형태별로 저장 (PART 4).
-- 자유이용권: 부위/강도/시간. 세션권(PT): 트레이너명. 예약권(클래스): 클래스명.
-- PT/클래스는 '부위' 개념이 없으므로 exercise_part를 nullable로 완화하고,
-- 형태별 부가정보(트레이너명/클래스명/종류/상태)는 기존 auto_data(jsonb)에 저장한다.
--   auto_data 예: { "kind": "session", "trainer": "김코치", "status": "세션 완료" }
--                 { "kind": "class", "className": "스피닝", "status": "수강 완료" }
--                 { "kind": "free", "status": "운동 완료" }
-- 멱등: drop not null / drop table if exists 는 재실행 안전.

alter table public.exercise_records alter column exercise_part drop not null;

-- db:push 검증용 임시 테이블 정리.
drop table if exists public._db_push_test;
