# FitBack — Supabase DB

Phase 1 데이터 모델(타입 정의 문서 기반)의 마이그레이션 모음입니다.
이 프로젝트는 **Supabase SQL Editor 수동 실행** 방식을 씁니다 (Supabase CLI 미사용).

## 빠른 시작 (팀원용)

처음 세팅하거나 새 Supabase 프로젝트에 적용할 때:

1. **테스트 계정 먼저 생성** — Supabase 대시보드 → Authentication → Users → **Add user**
   (Auto Confirm User 체크). 이 계정에 `memberships` 시드(가데이터)가 자동 연결됩니다.
   > 계정 없이 실행해도 됩니다. 그 경우 시드는 조용히 skip되고 테이블만 만들어집니다.
2. **SQL 실행** — 대시보드 → SQL Editor 에서 아래 중 하나:
   - **[setup.sql](setup.sql) 전체를 한 번에 붙여넣고 Run** ← 권장 (01~07 일괄)
   - 또는 `migrations/01 … 07` 을 **번호 순서대로** 하나씩 실행
3. **앱 확인** — `.env` 채운 뒤 `npm run web` → 로그인 → 회원권 3건(사용중 2 · 만료 1)이 보이면 성공.

> 모든 마이그레이션은 **멱등**합니다(`if not exists` / `drop policy if exists`). 여러 번 실행해도 안전하고,
> 시드는 해당 계정에 이미 회원권이 있으면 다시 넣지 않습니다.

## 파일 구조

```
supabase/
├── README.md          # 이 문서
├── setup.sql          # 01~07 통합본 (AUTO-GENERATED, 직접 수정 금지)
└── migrations/        # ← 원본(source of truth). 번호 순서대로 실행.
    ├── 01_init_profiles.sql
    ├── 02_extend_profiles.sql
    ├── 03_memberships.sql
    ├── 04_centers.sql
    ├── 05_visits.sql
    ├── 06_exercise_records.sql
    └── 07_user_preferences.sql
```

## 마이그레이션 목록

| # | 파일 | 테이블 | 내용 |
|---|------|--------|------|
| 01 | `01_init_profiles.sql` | `profiles` | 사용자 프로필 + `role`(member/admin) + `is_admin()` 헬퍼 + 가입 시 자동 생성 트리거 + 자가승격 방지 |
| 02 | `02_extend_profiles.sql` | `profiles`(확장) | 건강·기본정보 8컬럼 추가 (age, gender, height, weight, exercise_level, injury_history, medical_conditions, avoid_exercise_parts) |
| 03 | `03_memberships.sql` | `memberships` | 회원권(type: free/session/class, period, max_visits) **+ 테스트 계정 시드 3건** |
| 04 | `04_centers.sql` | `centers` | 센터/지점 (membership FK, GPS 위·경도) |
| 05 | `05_visits.sql` | `visits` | 센터 방문 기록 (체크인/아웃, 기분, 메모, 상태) |
| 06 | `06_exercise_records.sql` | `exercise_records` | 운동 기록 (강도/시간/메모 + `auto_data` **jsonb**: distance/calories/speed/source) |
| 07 | `07_user_preferences.sql` | `user_preferences` | 선호 설정 — **Phase 2**용. 테이블 구조만 생성, 기능 미활성화 |

**의존성** 때문에 번호 순서가 중요합니다: `profiles → memberships → centers/visits → exercise_records`.
(centers/visits 는 memberships FK, exercise_records 는 visits FK)

## RLS (행 수준 보안)

모든 테이블은 **본인 데이터만**(`auth.uid() = user_id`) select/insert/update/delete 가능합니다.
`admin` 정책은 [역할 전략](../CLAUDE.md)대로 아직 적용하지 않았습니다 (`is_admin()` 헬퍼만 준비됨).
admin이 필요해지면 각 정책에 `or is_admin()` 을 추가하세요.

## setup.sql 재생성

`setup.sql` 은 `migrations/` 를 합친 **생성물**입니다. 마이그레이션을 추가·수정하면 다시 생성하세요:

```bash
node scripts/build-setup-sql.js
```

새 마이그레이션은 `08_...` 처럼 **번호를 이어서** 만들면 스크립트가 자동으로 순서에 포함합니다.

## 검토 보류 사항 (합의 필요)

타입 문서를 스키마로 옮기며 아래는 합리적 기본값으로 정했습니다. 팀 합의로 바꿀 수 있습니다:

- **나이**: "20대/30대" 연령대가 아니라 **만나이 정수**(age, 1~120)로 저장.
- **enum 영문 슬러그화**: `exercise_level`(beginner/intermediate/advanced), `mood`(good/normal/tired),
  `intensity`(easy/normal/hard), `fitness_goal`(muscle_gain/fat_loss/endurance). 한글은 UI에서 매핑.
- **남은 횟수**: `memberships` 에는 사용 횟수 컬럼이 없습니다. "남은 N회"는 `visits` 연동 시 계산 예정 —
  현재 화면은 "총 N회"만 표시.
- **회원권 상태**: `active`/`expired` 만 `end_date` 로 파생. `paused`(일시중지)는 컬럼 없음 (필요 시 추가).

## 관련 코드

- 회원권 조회 훅: [`src/features/membership/useMemberships.ts`](../src/features/membership/useMemberships.ts)
- 회원권 화면: [`src/app/index.tsx`](../src/app/index.tsx)
