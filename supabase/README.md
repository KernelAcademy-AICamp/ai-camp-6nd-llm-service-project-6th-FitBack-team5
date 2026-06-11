# FitBack — Supabase DB

Phase 1 데이터 모델(타입 정의 문서 기반)의 마이그레이션 모음입니다.
**팀은 공유 Supabase 프로젝트 1개**를 함께 쓰며, Phase 1 스키마·시드는 **이미 적용돼 있습니다.**
적용은 **SQL Editor 수동 실행** 기준입니다 (`db:push` 자동화는 아래 *자동 적용* 주의 참고).

## 팀원 합류 (공유 프로젝트 — 대부분 여기)

DB는 이미 적용돼 있으니 **마이그레이션을 다시 실행하지 마세요.** 합류 절차만 하면 됩니다:

1. `git pull`
2. `npm install`
3. `.env` 만들기 — `.env.example` 복사 후 아래 값을 **팀 채널에서 받아** 채웁니다:
   - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (공유 프로젝트 값)
   - `EXPO_PUBLIC_DEV_TEST_EMAIL`, `EXPO_PUBLIC_DEV_TEST_PASSWORD` (공유 테스트 계정)
   - `SUPABASE_DB_URL` 은 **불필요** (마이그레이션을 직접 적용할 사람만 필요)
4. `npm run web` → 로그인(자동 채우기) → 공유 데이터(회원권 등) 표시
   > 🔒 URL·anon key·계정은 보안상 레포에 없습니다(`.env` 는 gitignore).

**새 테스트 계정을 직접 만들면** 그 계정엔 회원권 시드가 없습니다. SQL Editor에서
[03_memberships.sql](migrations/03_memberships.sql) 을 다시 Run 하면 됩니다
(멱등 — 회원권 없는 계정에만 3건 추가). 자주 만든다면 "새 계정 자동 시드 트리거" 도입을 고려하세요.

---

## 새 Supabase 프로젝트에 처음 적용 (리드 / 로컬 분리용)

새 프로젝트에 스키마를 처음 올릴 때:

1. **테스트 계정 먼저 생성** — Supabase 대시보드 → Authentication → Users → **Add user**
   (Auto Confirm User 체크). `memberships` 시드는 **모든 계정**에 3건씩 들어갑니다.
   > 계정 없이 실행해도 됩니다. 그 경우 시드는 skip되고 테이블만 만들어집니다.
2. **마이그레이션 적용** — **SQL Editor**: 대시보드 → SQL Editor 에 [setup.sql](setup.sql) 전체를
   붙여넣고 Run (또는 `migrations/01 … 07` 을 **번호 순서대로**). `npm run db:push` 는 아래 주의 참고.
3. **앱 확인** — `.env` 채운 뒤 `npm run web` → 로그인 → 회원권 3건(사용중 2 · 만료 1)이 보이면 성공.

> 모든 마이그레이션은 **멱등**입니다(`if not exists` / `drop policy if exists`). 여러 번 실행해도 안전하고,
> 시드는 계정에 이미 회원권이 있으면 다시 넣지 않습니다(새 계정만 추가).

## 자동 적용 (`npm run db:push`)

> ⚠️ **현재 미검증.** 공유 프로젝트의 pooler 호스트(`aws-0`/`aws-1`…)가 확정되지 않아 아직 한 번도
> 연결에 성공하지 못했습니다. 호스트가 확정되기 전까지는 위 **SQL Editor 방법**을 쓰세요.
> (호스트만 맞추면 바로 동작하도록 스크립트는 준비돼 있습니다.)

Node `pg` 패키지로 [setup.sql](setup.sql) 을 DB에 직접 적용합니다 (psql·SQL Editor 불필요, 크로스플랫폼).

**1회 셋업:**

1. **의존성 설치** — `npm install` (`pg` 포함, 시스템 설치 불필요)
2. **DB 연결 URL을 `.env` 에 추가** — 대시보드 → Project Settings → Database →
   **Connection string (URI)** 복사 (DB 비밀번호 포함):
   ```
   SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres
   ```
   > `EXPO_PUBLIC_` 접두사가 **없습니다** — 앱 번들에 들어가면 안 되는 비밀이라 일부러 제외했습니다.
   > `.env` 는 gitignore 되어 커밋되지 않습니다.

**이후 적용:**
```bash
npm run db:push   # setup.sql 재생성 후 pg 로 적용 (멱등 — 여러 번 안전)
```

> ⚠️ anon key로는 `create table` 같은 DDL을 실행할 수 없어, 이 방식엔 **DB 비밀번호**가 필요합니다.

## 파일 구조

```
supabase/
├── README.md          # 이 문서
├── setup.sql          # 01~08 통합본 (AUTO-GENERATED, 직접 수정 금지)
└── migrations/        # ← 원본(source of truth). 번호 순서대로 실행.
    ├── 01_init_profiles.sql
    ├── 02_extend_profiles.sql
    ├── 03_memberships.sql
    ├── 04_centers.sql
    ├── 05_visits.sql
    ├── 06_exercise_records.sql
    ├── 07_user_preferences.sql
    └── 08_seed_demo_data.sql
```

## 마이그레이션 목록

| # | 파일 | 테이블 | 내용 |
|---|------|--------|------|
| 01 | `01_init_profiles.sql` | `profiles` | 사용자 프로필 + `role`(member/admin) + `is_admin()` 헬퍼 + 가입 시 자동 생성 트리거 + 자가승격 방지 |
| 02 | `02_extend_profiles.sql` | `profiles`(확장) | 건강·기본정보 8컬럼 추가 (age, gender, height, weight, exercise_level, injury_history, medical_conditions, avoid_exercise_parts) |
| 03 | `03_memberships.sql` | `memberships` | 회원권(type: free/session/class, period, max_visits) + RLS *(시드는 08로 이동)* |
| 04 | `04_centers.sql` | `centers` | 센터/지점 (membership FK, GPS 위·경도) |
| 05 | `05_visits.sql` | `visits` | 센터 방문 기록 (체크인/아웃, 기분, 메모, 상태) |
| 06 | `06_exercise_records.sql` | `exercise_records` | 운동 기록 (강도/시간/메모 + `auto_data` **jsonb**: distance/calories/speed/source) |
| 07 | `07_user_preferences.sql` | `user_preferences` | 선호 설정 — **Phase 2**용. 테이블 구조만 생성, 기능 미활성화 |
| 08 | `08_seed_demo_data.sql` | (전 테이블 시드) | 데모 데이터 — `seed_demo_data_for_user()` 함수 + 신규 계정 자동 트리거 + 기존 계정 백필(리셋). ⚠️ 개발용 |

**의존성** 때문에 번호 순서가 중요합니다: `profiles → memberships → centers/visits → exercise_records`.
(centers/visits 는 memberships FK, exercise_records 는 visits FK)

## RLS (행 수준 보안)

모든 테이블은 **본인 데이터만**(`auth.uid() = user_id`) select/insert/update/delete 가능합니다.
`admin` 정책은 [역할 전략](../CLAUDE.md)대로 아직 적용하지 않았습니다 (`is_admin()` 헬퍼만 준비됨).
admin이 필요해지면 각 정책에 `or is_admin()` 을 추가하세요.

## setup.sql 재생성

`setup.sql` 은 `migrations/` 를 합친 **생성물**입니다. 마이그레이션을 추가·수정하면 다시 생성하세요:

```bash
npm run db:build      # = node scripts/build-setup-sql.js
```

(`npm run db:push` 는 적용 전에 자동으로 재생성하므로 보통 따로 실행할 필요는 없습니다.)
새 마이그레이션은 `08_...` 처럼 **번호를 이어서** 만들면 스크립트가 자동으로 순서에 포함합니다.

## 결정 사항 (확정)

타입 문서를 스키마로 옮기며 아래 항목은 팀 확인을 거쳐 확정했습니다:

- **나이**: ✅ **만나이 정수**(age, 1~120)로 저장. 연령대(20대/30대)는 정수에서 파생.
- **enum 영문 슬러그**: ✅ `exercise_level`(beginner/intermediate/advanced), `mood`(good/normal/tired),
  `intensity`(easy/normal/hard), `fitness_goal`(muscle_gain/fat_loss/endurance). 한글은 UI에서 매핑.
- **남은 횟수**: ✅ **visits 연동 구현됨** — `useMemberships()` 가 `visits(count)` 집계로 사용 횟수를 구해
  session/class 회원권에 "남은 X/Y회"를 계산합니다 (free는 무제한).
- **회원권 상태**: ✅ `active`/`expired` 만 `end_date` 로 파생. `paused`(일시중지)는 미도입 (필요 시 컬럼 추가).

## 관련 코드

- 회원권 조회 훅: [`src/features/membership/useMemberships.ts`](../src/features/membership/useMemberships.ts)
- 회원권 화면: [`src/app/index.tsx`](../src/app/index.tsx)
