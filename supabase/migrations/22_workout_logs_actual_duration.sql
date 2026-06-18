-- workout_logs: 실제 경과 시간(초) 컬럼 추가
--
-- 변경 의도:
--   계획된 운동 시간(duration_min, 루틴 meta에서 파싱)과 별개로,
--   사용자가 실제로 세션 화면에 머문 시간을 초 단위로 기록한다.
--   일부 완료 시 "실제/계획" 비율 표시(예: "10 / 15분")에 사용.
--
-- 기존 row 는 NULL — 표시 측에서 NULL 이면 계획 시간만 노출.

alter table public.workout_logs
  add column if not exists actual_duration_sec int;
