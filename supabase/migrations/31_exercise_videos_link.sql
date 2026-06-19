-- ============================================================
-- 31_exercise_videos_link.sql
-- exercises.video_url 에 Storage 업로드 영상의 public URL 연결.
--
-- 매핑:
--   스쿼트       → squat.mp4
--   코브라 자세  → cobra.mp4
--   플랭크       → plank.mp4
--
-- 적용 전 30 마이그레이션으로 video_url 컬럼 + exercise-videos 버킷이 있어야 함.
-- 운동 행이 없으면 UPDATE 가 0 rows affected — 무해.
-- ============================================================

update public.exercises
   set video_url = 'https://cmghfzlctogzknbobdxn.supabase.co/storage/v1/object/public/exercise-videos/squat.mp4'
 where name = '스쿼트';

update public.exercises
   set video_url = 'https://cmghfzlctogzknbobdxn.supabase.co/storage/v1/object/public/exercise-videos/cobra.mp4'
 where name = '코브라 자세';

update public.exercises
   set video_url = 'https://cmghfzlctogzknbobdxn.supabase.co/storage/v1/object/public/exercise-videos/plank.mp4'
 where name = '플랭크';
