#!/usr/bin/env node
/**
 * Applies supabase/setup.sql to your Supabase Postgres using node-postgres (pg).
 * No psql / Homebrew needed — just `npm install`.
 *
 * Reads SUPABASE_DB_URL from the environment or .env. Get it from the Supabase
 * dashboard → Project Settings → Database → Connection string (URI). It contains
 * your DB password, so it lives in .env (gitignored), never in the repo.
 *
 * Usage:  npm run db:push   (rebuilds setup.sql first, then applies it)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const setupSqlPath = path.join(root, 'supabase', 'setup.sql');

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

let Client;
try {
  ({ Client } = require('pg'));
} catch {
  console.error('✗ pg 패키지를 찾을 수 없습니다. 먼저 의존성을 설치하세요:  npm install');
  process.exit(1);
}

const sql = fs.readFileSync(setupSqlPath, 'utf8');

(async () => {
  // Supabase requires TLS. rejectUnauthorized:false avoids cert-chain hiccups
  // on direct connections; the link is still encrypted.
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    console.log('→ Connecting to Supabase …');
    await client.connect();
    console.log('→ Applying supabase/setup.sql …');
    await client.query(sql); // setup.sql is idempotent; safe to re-run.
    console.log('✓ Done.');
  } catch (err) {
    console.error('✗ 적용 실패:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
