-- ============================================================
-- 26_exercise_add_cobra.sql
-- exercises 카탈로그에 "코브라 자세"(Bhujangasana) 1건 추가.
--
-- 분류:
--   body_region   = 스트레칭 (코치 톤 'stretch' — 명상적)
--   exercise_type = ['유연성']
--   goal_tags     = ['자세 개선']      — 가슴·척추 확장이 자세 교정에 효과
--   phase_tags    = ['cooldown','recovery'] — 마무리/회복 용도
--   intensity     = 1  (매우 가벼움)
-- 시간 기반(30초 default) — workout-ai 의 stretch warmup/cooldown 후보에 포함됨.
--
-- 주의:
--   place_tags 컬럼은 마이그레이션 23 에서 DROP 됐을 수 있어 INSERT 컬럼 목록에서 제외.
--   허리 통증자는 contraindicated_parts 로 제외되도록 '허리' 명시.
-- ============================================================

insert into public.exercises (
  name, body_region, exercise_type, goal_tags, phase_tags,
  target_parts, contraindicated_parts, equipment, is_high_impact, intensity,
  default_sets, default_reps, min_reps, max_reps,
  default_duration_sec, min_duration_sec, max_duration_sec,
  description_text, caution_text,
  early_reps, middle_reps, form_cues, final_reps,
  time_scripts, halfway_encouragement
) values
('코브라 자세', '스트레칭', array['유연성'], array['자세 개선'],
 array['cooldown','recovery'],
 array['척추','가슴','복부','어깨'], array['허리','손목'], array[]::text[],
 false, 1,
 null, null, null, null,
 30, 15, 45,
 '엎드린 자세에서 손바닥으로 바닥을 천천히 밀어 상체만 들어올립니다.',
 '허리 통증이 있다면 무리하지 말고 낮게 시작하세요.',
 array[]::text[], array[]::text[], array[]::text[], array[]::text[],
 array[
   '엎드려 손바닥을 어깨 옆에 둡니다.',
   '팔꿈치는 옆구리에 붙이고 천천히 밀어 상체를 들어올립니다.',
   '가슴을 펴고 시선은 살짝 위를 보세요.',
   '어깨는 귀에서 멀리 떨어뜨려요.',
   '호흡을 깊게 유지합니다.'
 ],
 '어깨 긴장 풀고 호흡 유지하세요.');
