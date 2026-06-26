// FitBack AI 코치 평가 러너 — 배포된 ai-feedback EF를 호출해 실제 응답을 수집한다.
// 사용: node docs/eval/run-eval.mjs   (.env의 SUPABASE URL/ANON 키 사용)
// 출력: docs/eval/responses.json
import { readFileSync, writeFileSync } from 'node:fs';

// --- .env 로드(간이) ---
const env = {};
for (const line of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL_BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_BASE || !ANON) { console.error('SUPABASE URL/ANON 키 누락'); process.exit(1); }
const ENDPOINT = `${URL_BASE}/functions/v1/ai-feedback`;

const ds = JSON.parse(readFileSync(new URL('./dataset.json', import.meta.url), 'utf8'));

async function callEF(userContext, roi, userMessage, photoAnalysis) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: ANON,
      authorization: `Bearer ${ANON}`,
    },
    body: JSON.stringify({ userContext, roi, userMessage, photoAnalysis: photoAnalysis ?? null, history: [] }),
  });
  if (!res.ok) return { __error: `HTTP ${res.status}`, __body: await res.text() };
  return res.json();
}

const out = [];
for (const s of ds.samples) {
  const ctx = { ...ds.base.userContext, ...(s.ctx ?? {}) };
  const roi = s.roi === null ? null : (s.roi ?? ds.base.roi);
  const runs = s.repeat ?? 1;
  for (let r = 1; r <= runs; r++) {
    process.stdout.write(`→ ${s.id}${runs > 1 ? `#${r}` : ''} (${s.expect}) ... `);
    let resp;
    try { resp = await callEF(ctx, roi, s.msg, s.photoAnalysis); }
    catch (e) { resp = { __error: String(e) }; }
    console.log(resp.__error ? `ERR ${resp.__error}` : `intent=${resp.intent}`);
    out.push({ id: s.id, run: r, expect: s.expect, kind: s.kind, edge_type: s.edge_type ?? null, msg: s.msg, response: resp });
  }
}
const suffix = process.argv[2] ? `-${process.argv[2]}` : '';
const outName = `responses${suffix}.json`;
writeFileSync(new URL(`./${outName}`, import.meta.url), JSON.stringify(out, null, 2));
console.log(`\n완료: ${out.length}건 → docs/eval/${outName}`);
