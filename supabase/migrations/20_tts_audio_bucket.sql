-- ============================================================
-- 18_tts_audio_bucket.sql
-- OpenAI TTS 합성 결과(MP3)를 보관할 Storage 버킷 생성.
-- public 으로 두어 클라이언트가 URL 로 직접 재생 가능.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('tts-audio', 'tts-audio', true)
on conflict (id) do nothing;

-- 인증된 사용자가 오디오 URL 을 SELECT(metadata 조회) 할 수 있도록.
-- 파일 자체는 public 이라 직접 GET 가능하지만,
-- supabase-js 가 getPublicUrl 외에 list/info 를 쓸 때 필요.
drop policy if exists "tts-audio readable to all" on storage.objects;
create policy "tts-audio readable to all"
  on storage.objects for select
  using (bucket_id = 'tts-audio');
