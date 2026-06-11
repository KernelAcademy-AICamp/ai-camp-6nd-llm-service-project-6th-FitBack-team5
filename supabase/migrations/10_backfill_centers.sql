-- 10_backfill_centers.sql — 센터(좌표) 없는 회원권에 기본 좌표 보정 (개발/테스트용).
-- Run AFTER 09. GPS 도착·날씨·경로는 센터 좌표가 있어야 동작하는데, 온보딩으로
-- 등록한 회원권 중 좌표를 안 넣은 것은 센터가 없다. 그런 회원권에 기본 좌표(강남역)를
-- 채운다. 멱등: 이미 센터가 있는 회원권은 건너뛴다.
--
-- ※ 이후 회원권 등록 시 '현재 위치를 센터로' 버튼으로 좌표를 넣으면 이 보정은 불필요.

insert into public.centers (user_id, membership_id, name, latitude, longitude)
select m.user_id, m.id, m.name, 37.49794500, 127.02758100
from public.memberships m
where not exists (
  select 1 from public.centers c where c.membership_id = m.id
);
