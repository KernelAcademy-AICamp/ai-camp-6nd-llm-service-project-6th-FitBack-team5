-- 25_visits_verification.sql
-- 체크인 UX Flow 명세 §6 — 방문 검증/자기신고 구분 + 회수 금액 기록.
--   method        : geofence(지오펜스 검증) / fallback(자기신고 보정)
--   verify_status : verified / unverified
--   recovered_amount : 이 방문으로 발생한 회수액(원). unverified면 0.
--   center_lat/lng, distance_m : 검증 근거(반경 100m 판정)
-- 멱등(idempotent).
alter table public.visits add column if not exists method text
  check (method is null or method in ('geofence', 'fallback'));
alter table public.visits add column if not exists verify_status text
  check (verify_status is null or verify_status in ('verified', 'unverified'));
alter table public.visits add column if not exists recovered_amount integer not null default 0
  check (recovered_amount >= 0);
alter table public.visits add column if not exists center_lat double precision;
alter table public.visits add column if not exists center_lng double precision;
alter table public.visits add column if not exists distance_m double precision;
