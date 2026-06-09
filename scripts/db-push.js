#!/usr/bin/env node
/**
 * Applies supabase/setup.sql to your Supabase Postgres using psql.
 *
 * Reads SUPABASE_DB_URL from the environment or .env. Get it from the Supabase
 * dashboard → Project Settings → Database → Connection string (URI). It contains
 * your DB password, so it lives in .env (gitignored), never in the repo.
 *
 * Requires the `psql` client on PATH (macOS: `brew install libpq` then
 * `brew link --force libpq`).
 *
 * Usage:  npm run db:push   (rebuilds setup.sql first, then applies it)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const setupSql = path.join(root, 'supabase', 'setup.sql');

function readEnvVar(key) {
  if (process.env[key]) return process.env[key];
  if (!fs.existsSync(envPath)) return undefined;
  const match = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith(`${key}=`));
  if (!match) return undefined;
  let value = match.slice(match.indexOf('=') + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value || undefined;
}

const dbUrl = readEnvVar('SUPABASE_DB_URL');
if (!dbUrl) {
  console.error('✗ SUPABASE_DB_URL 이 설정돼 있지 않습니다 (.env 또는 환경변수).');
  console.error('  Supabase 대시보드 → Project Settings → Database → Connection string (URI)');
  console.error('  를 복사해 .env 에 아래처럼 추가하세요:');
  console.error('    SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres');
  process.exit(1);
}

try {
  execFileSync('psql', ['--version'], { stdio: 'ignore' });
} catch {
  console.error('✗ psql 을 찾을 수 없습니다. PostgreSQL 클라이언트를 설치하세요.');
  console.error('  macOS: brew install libpq && brew link --force libpq');
  process.exit(1);
}

console.log('→ Applying supabase/setup.sql …');
try {
  execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', setupSql], { stdio: 'inherit' });
  console.log('✓ Done.');
} catch {
  // psql already printed the error; exit non-zero without a noisy stack trace.
  process.exit(1);
}
