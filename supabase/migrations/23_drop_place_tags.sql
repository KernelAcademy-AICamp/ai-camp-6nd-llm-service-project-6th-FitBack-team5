-- exercises: place_tags 컬럼 제거
--
-- 변경 의도:
--   FitBack 은 홈트 전용 앱 — '집'/'야외'/'헬스장' 분기는 더 이상 쓰지 않는다.
--   루틴 생성에서 장소 질문이 제거됐고, filterCandidates 도 place_tags 필터를 제거.
--   인덱스 + 컬럼 모두 dead weight 가 되어 정리.
--
-- 비가역 작업 — drop 후 데이터는 복구 불가.

drop index if exists public.exercises_place_tags_gin;

alter table public.exercises
  drop column if exists place_tags;
