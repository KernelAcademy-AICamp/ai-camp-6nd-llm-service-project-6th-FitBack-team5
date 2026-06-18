-- workout_logs: 운동 완료 시점 자동 저장 + 리뷰 분리 저장을 위한 스키마 조정
--
-- 변경 의도:
--   1) 운동 완료 페이지 진입 즉시 calories/completion_status/ai_feedback 을 자동 저장한다.
--      이 시점에 사용자는 아직 리뷰(난이도/통증/메모)를 입력하지 않았으므로 difficulty 는 NULL 이어야 한다.
--   2) 사용자가 "운동 리뷰 남기기" 버튼을 누르면 같은 row 를 UPDATE 하여 difficulty/pain_areas/memo 를 채운다.
--      RLS 에 own update 정책이 없었으므로 추가한다.
--   3) calories 컬럼을 신설. 루틴의 운동 강도·시간·사용자 체중으로 계산한 추정치.

alter table public.workout_logs
  add column if not exists calories int default 0;

-- difficulty 를 NULL 허용으로 변경. 기존 CHECK (difficulty in ('easy','good','hard')) 는
-- NULL 값에 대해 자동으로 통과하므로 그대로 둔다.
alter table public.workout_logs
  alter column difficulty drop not null;

-- 본인 기록만 수정 가능 (리뷰 추가·AI 피드백 백필 용도)
drop policy if exists "workout_logs: own update" on public.workout_logs;
create policy "workout_logs: own update"
  on public.workout_logs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
