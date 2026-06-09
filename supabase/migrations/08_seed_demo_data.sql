-- 08_seed_demo_data.sql — 전 테이블 데모(가) 데이터. Run AFTER 07_user_preferences.sql.
--
-- 함수 seed_demo_data_for_user(uid) 하나로 6개 테이블을 FK 관계까지 일관되게 채우고,
-- 이를 (a) 신규 계정 자동 트리거 + (b) 기존 계정 백필 에 재사용합니다.
--   memberships → centers/visits (membership FK) → exercise_records (visit FK)
--
-- ⚠️ 개발용입니다. 프로덕션 전환 시 자동 트리거(on_auth_user_created_demo_seed)를 제거하세요.
--    (실제 가입자에게 가짜 데이터가 들어가면 안 되므로)

-- ============================================================
-- 한 유저에 전 테이블 데모 데이터 (계정별 멱등: 이미 회원권 있으면 skip)
-- security definer: 신규 계정 트리거 컨텍스트에서도 RLS 우회해 insert.
-- ============================================================
create or replace function public.seed_demo_data_for_user(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m_pt uuid;
  m_yoga uuid;
  m_pilates uuid;
  v_id uuid;
begin
  -- 이미 시드된 계정이면 아무것도 하지 않음 (중복 방지)
  if exists (select 1 from public.memberships where user_id = uid) then
    return;
  end if;

  -- 1) profiles — 건강·기본 정보 (행 자체는 handle_new_user 트리거가 이미 생성)
  update public.profiles set
    age = 28,
    gender = 'M',
    height = 175,
    weight = 72.5,
    exercise_level = 'intermediate',
    injury_history = '오른쪽 어깨 회전근개 경미 (2024)',
    medical_conditions = null,
    avoid_exercise_parts = array['shoulder']
  where id = uid;

  -- 2) memberships — 3건 (기준일 ~2026-06-09: 사용중 2 + 만료 1)
  insert into public.memberships (user_id, name, cost, period, start_date, end_date, type, max_visits)
  values (uid, '강남 PT 30회', 1800000, '6month', date '2026-04-01', date '2026-10-01', 'session', 30)
  returning id into m_pt;

  insert into public.memberships (user_id, name, cost, period, start_date, end_date, type, max_visits)
  values (uid, '요가 1개월권', 120000, 'month', date '2026-06-01', date '2026-07-01', 'free', null)
  returning id into m_yoga;

  insert into public.memberships (user_id, name, cost, period, start_date, end_date, type, max_visits)
  values (uid, '필라테스 10회', 350000, '3month', date '2026-02-01', date '2026-05-01', 'class', 10)
  returning id into m_pilates;

  -- 3) centers — membership 별 센터 (GPS: 서울 강남 일대 예시)
  insert into public.centers (user_id, membership_id, name, address, latitude, longitude) values
    (uid, m_pt,      '강남 피트니스',        '서울 강남구 테헤란로 123', 37.50120000, 127.03680000),
    (uid, m_yoga,    '요가 스튜디오 압구정', '서울 강남구 압구정로 45',  37.52700000, 127.02850000),
    (uid, m_pilates, '코어 필라테스 선릉',   '서울 강남구 선릉로 200',   37.50450000, 127.04900000);

  -- 4) visits + 5) exercise_records — 방문마다 운동 기록 연결
  -- PT 방문 #1 (하체)
  insert into public.visits (user_id, membership_id, center_name, check_in_time, check_out_time, total_exercise_minutes, mood, notes, status)
  values (uid, m_pt, '강남 피트니스', timestamptz '2026-06-01 19:00+09', timestamptz '2026-06-01 20:10+09', 70, 'good', '하체 집중', 'checked_in')
  returning id into v_id;
  insert into public.exercise_records (user_id, visit_id, exercise_part, intensity, duration, notes, auto_data) values
    (uid, v_id, 'legs', 'hard',   40, '스쿼트 5x5, 레그프레스 4세트', null),
    (uid, v_id, 'core', 'normal', 20, '플랭크 3세트, 행잉레그레이즈', null);

  -- PT 방문 #2 (상체 + 유산소, OCR 자동데이터 예시)
  insert into public.visits (user_id, membership_id, center_name, check_in_time, check_out_time, total_exercise_minutes, mood, notes, status)
  values (uid, m_pt, '강남 피트니스', timestamptz '2026-06-04 18:30+09', timestamptz '2026-06-04 19:40+09', 70, 'normal', '상체 + 가벼운 유산소', 'checked_in')
  returning id into v_id;
  insert into public.exercise_records (user_id, visit_id, exercise_part, intensity, duration, notes, auto_data) values
    (uid, v_id, 'chest',  'normal', 35, '벤치프레스, 인클라인 덤벨', null),
    (uid, v_id, 'cardio', 'easy',   20, '트레드밀 (러닝머신 OCR)', '{"distance": 3.2, "calories": 240, "speed": 9.6, "source": "ocr"}'::jsonb);

  -- 요가 방문 #1 (전신)
  insert into public.visits (user_id, membership_id, center_name, check_in_time, check_out_time, total_exercise_minutes, mood, notes, status)
  values (uid, m_yoga, '요가 스튜디오 압구정', timestamptz '2026-06-06 07:00+09', timestamptz '2026-06-06 08:00+09', 60, 'good', '아침 빈야사', 'checked_in')
  returning id into v_id;
  insert into public.exercise_records (user_id, visit_id, exercise_part, intensity, duration, notes, auto_data) values
    (uid, v_id, 'fullbody', 'easy', 60, '빈야사 플로우', null);

  -- 6) user_preferences — Phase 2 (구조만 활성). 데모 1건.
  insert into public.user_preferences (user_id, preferred_exercise_times, preferred_exercise_parts, fitness_goal)
  values (uid, array['06:00-08:00', '18:00-20:00'], array['chest', 'back', 'legs'], 'muscle_gain')
  on conflict (user_id) do nothing;
end;
$$;

-- ============================================================
-- 신규 계정 자동 시드 트리거 (개발용)
-- profile 생성(on_auth_user_created) 직후 실행되도록 트리거 이름을 잡았습니다.
-- 시드 실패가 회원가입을 막지 않도록 예외를 흡수합니다.
-- ⚠️ 프로덕션 전 이 트리거를 제거하세요.
-- ============================================================
create or replace function public.handle_new_user_demo_seed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.seed_demo_data_for_user(new.id);
  exception when others then
    raise warning 'demo seed skipped for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_demo_seed on auth.users;
create trigger on_auth_user_created_demo_seed
  after insert on auth.users
  for each row execute function public.handle_new_user_demo_seed();

-- ============================================================
-- 기존 모든 계정 백필 (개발용 리셋)
-- ⚠️ 각 계정의 기존 memberships(+cascade로 centers/visits/exercise_records)와
--    user_preferences 를 지우고 데모 데이터를 새로 만듭니다.
--    수동으로 넣은 데이터가 있으면 사라지니, 개발 환경에서만 실행하세요.
-- ============================================================
do $$
declare
  u record;
  n integer := 0;
begin
  for u in select id from auth.users loop
    delete from public.memberships where user_id = u.id;       -- cascade: centers/visits/exercise_records
    delete from public.user_preferences where user_id = u.id;  -- membership FK가 아니라 별도 삭제
    perform public.seed_demo_data_for_user(u.id);
    n := n + 1;
  end loop;
  raise notice 'demo seed: reset + seeded % account(s).', n;
end $$;
