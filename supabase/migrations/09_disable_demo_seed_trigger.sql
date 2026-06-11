-- 09_disable_demo_seed_trigger.sql — 온보딩에서 회원권을 직접 등록하므로,
-- 08의 "신규 계정 자동 시드 트리거"를 비활성화합니다.
-- Run AFTER 08. 기존 DB에는 이 파일만 SQL Editor에서 Run 하면 트리거가 제거됩니다.
--
-- seed_demo_data_for_user() 함수와 백필 결과는 그대로 둡니다(개발용 수동 시드에 사용).
-- 다시 켜려면 08의 create trigger 블록을 재실행하세요.

drop trigger if exists on_auth_user_created_demo_seed on auth.users;
