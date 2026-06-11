#!/usr/bin/env bash
# 개발용 테스트 계정을 Supabase에 생성한다 (.env의 값 사용).
# CLAUDE.md "다음 작업 1번(Add user)"을 CLI로 자동화한 것.
#
# 사용법:  bash scripts/create-test-user.sh
# 필요:    .env 에 EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
#          SUPABASE_SERVICE_ROLE_KEY, EXPO_PUBLIC_DEV_TEST_EMAIL/_PASSWORD
set -euo pipefail
cd "$(dirname "$0")/.."

get() { grep "^$1=" .env | cut -d= -f2- | tr -d '"'"'"'\r'; }
url=$(get EXPO_PUBLIC_SUPABASE_URL)
anon=$(get EXPO_PUBLIC_SUPABASE_ANON_KEY)
svc=$(get SUPABASE_SERVICE_ROLE_KEY)
email=$(get EXPO_PUBLIC_DEV_TEST_EMAIL)
pass=$(get EXPO_PUBLIC_DEV_TEST_PASSWORD)

[ -n "$svc" ] || { echo "✗ SUPABASE_SERVICE_ROLE_KEY 없음"; exit 1; }
echo "→ 계정 생성: $email  (프로젝트: $(echo "$url" | sed -E 's#https://([a-z0-9]{6}).*#\1…#'))"

create=$(curl -s -X POST "$url/auth/v1/admin/users" \
  -H "apikey: $svc" -H "Authorization: Bearer $svc" -H "Content-Type: application/json" \
  -d "{\"email\":\"$email\",\"password\":\"$pass\",\"email_confirm\":true}")
status=$(echo "$create" | python3 -c "import sys,json
d=json.load(sys.stdin)
if d.get('id'): print('created')
elif d.get('error_code')=='email_exists' or 'already' in json.dumps(d).lower(): print('exists')
else: print('error'); sys.stderr.write(json.dumps(d, ensure_ascii=False)); sys.exit(1)")

if [ "$status" = "created" ]; then
  echo "  생성 OK"
else
  echo "  이미 존재함 → .env 비번으로 재설정"
  # 기존 유저 id 조회 (이메일로 매칭)
  uid=$(curl -s "$url/auth/v1/admin/users?per_page=200" \
    -H "apikey: $svc" -H "Authorization: Bearer $svc" \
    | python3 -c "import sys,json;u=json.load(sys.stdin).get('users',[]);m=[x for x in u if x.get('email')=='$email'];print(m[0]['id'] if m else '')")
  [ -n "$uid" ] || { echo "  ✗ 유저 id 조회 실패"; exit 1; }
  reset=$(curl -s -X PUT "$url/auth/v1/admin/users/$uid" \
    -H "apikey: $svc" -H "Authorization: Bearer $svc" -H "Content-Type: application/json" \
    -d "{\"password\":\"$pass\",\"email_confirm\":true}")
  echo "$reset" | python3 -c "import sys,json
d=json.load(sys.stdin)
print('  비번 재설정 OK' if d.get('id') else '  ✗ 재설정 실패: '+json.dumps(d, ensure_ascii=False))"
fi

echo "→ 로그인 재검증"
resp=$(curl -s -X POST "$url/auth/v1/token?grant_type=password" \
  -H "apikey: $anon" -H "Content-Type: application/json" \
  -d "{\"email\":\"$email\",\"password\":\"$pass\"}")
echo "$resp" | python3 -c "import sys,json
d=json.load(sys.stdin)
print('  LOGIN OK ✅ — 앱에서 자동채우기→로그인 됩니다' if 'access_token' in d else '  LOGIN FAIL: '+json.dumps(d, ensure_ascii=False))"
