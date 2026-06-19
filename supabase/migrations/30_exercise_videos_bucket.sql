-- ============================================================
-- 30_exercise_videos_bucket.sql
-- 운동 시범 영상(MP4) 저장용 Storage 버킷 + exercises.video_url 컬럼.
--
-- 사용:
--   1) Studio Storage 에 squat.mp4 / cobra.mp4 / plank.mp4 업로드
--   2) update exercises set video_url='<publicURL>' where name='스쿼트'; ...
--   3) session.tsx 에서 current.video_url 있으면 <video>/expo-video 로 재생
--
-- public read — 영상은 사용자 비특정 콘텐츠라 인증 없이 URL 직접 GET 가능.
-- MIME video/mp4, 50MB 상한 — 임의 파일 업로드 차단 + 30초 안팎 운동 영상에 충분.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-videos',
  'exercise-videos',
  true,
  52428800,                    -- 50 MB
  array['video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- public 버킷이지만 list/metadata 조회는 RLS 정책 필요.
drop policy if exists "exercise-videos readable to all" on storage.objects;
create policy "exercise-videos readable to all"
  on storage.objects for select
  using (bucket_id = 'exercise-videos');

-- exercises 테이블에 video_url 컬럼 추가 (nullable — 영상 없는 운동은 기존처럼 텍스트만).
alter table public.exercises
  add column if not exists video_url text;
