-- workout_logs: body_part 컬럼 추가 (식단 탭 운동 연동용)
-- 값: 'lower' | 'upper' | 'full' | 'cardio' | null
-- complete.tsx가 routine_title 키워드를 파싱해 저장한다.
alter table public.workout_logs
  add column if not exists body_part text
    check (body_part in ('lower', 'upper', 'full', 'cardio'));
