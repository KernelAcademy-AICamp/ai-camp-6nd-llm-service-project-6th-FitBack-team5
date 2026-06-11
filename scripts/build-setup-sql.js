#!/usr/bin/env node
/**
 * Generates supabase/setup.sql by concatenating every numbered migration in
 * supabase/migrations/ in filename order. setup.sql is a convenience bundle so
 * a teammate can paste the whole Phase 1 schema into the Supabase SQL Editor
 * once, instead of running 01..07 one by one.
 *
 * The individual migration files are the source of truth. After editing any of
 * them, regenerate the bundle:
 *
 *   node scripts/build-setup-sql.js
 */
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const outFile = path.join(__dirname, '..', 'supabase', 'setup.sql');

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort(); // 01_, 02_, ... — zero-padded prefixes sort in run order.

if (files.length === 0) {
  console.error(`No .sql files found in ${migrationsDir}`);
  process.exit(1);
}

const header = `-- ============================================================
-- FitBack — 통합 DB 셋업 (AUTO-GENERATED — 직접 수정하지 마세요)
-- supabase/migrations/ 의 모든 마이그레이션을 실행 순서대로 합친 파일입니다.
-- 재생성: node scripts/build-setup-sql.js
--
-- 사용법: Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run.
-- 사전 준비: Authentication → Users 에서 테스트 계정을 먼저 만들면
--            03_memberships 의 시드(가데이터)가 그 계정에 자동 연결됩니다.
--            계정이 없으면 시드는 조용히 skip 되고 테이블만 생성됩니다.
-- 멱등성: 모든 마이그레이션은 여러 번 실행해도 안전합니다.
-- ============================================================
`;

const banner = (name) =>
  `\n\n-- ████████████████████████████████████████████████████████████\n` +
  `-- ${name}\n` +
  `-- ████████████████████████████████████████████████████████████\n\n`;

const body = files
  .map((f) => banner(f) + fs.readFileSync(path.join(migrationsDir, f), 'utf8').trimEnd() + '\n')
  .join('');

fs.writeFileSync(outFile, header + body, 'utf8');
console.log(`Wrote ${path.relative(process.cwd(), outFile)} from ${files.length} migration(s):`);
files.forEach((f) => console.log(`  - ${f}`));
