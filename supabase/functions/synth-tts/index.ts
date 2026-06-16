// Supabase Edge Function: OpenAI TTS 합성 + 영구 캐시.
// 배포: supabase functions deploy synth-tts
// 시크릿: supabase secrets set OPENAI_API_KEY=sk-...
// 호출: POST {SUPABASE_URL}/functions/v1/synth-tts  (body: { text })
//
// 동작:
//   1) text_hash = sha256(text || ':' || TTS_VERSION) 계산
//   2) tts_cache 조회 → HIT 면 audio_url 즉시 반환
//   3) MISS 면 OpenAI tts-1/nova 호출 → MP3 ArrayBuffer 수신
//   4) Storage(tts-audio) 에 {hash}.mp3 업로드
//   5) tts_cache 에 행 upsert → audio_url 반환
//
// deno 런타임 — 앱(tsc) 빌드 대상이 아니라 tsconfig 에서 제외됨.

import { createClient } from 'npm:@supabase/supabase-js@2';

declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (req: Request) => Response | Promise<Response>): void;
};

// 음성/모델/INSTRUCTIONS 변경 시 이 숫자를 +1 → 기존 캐시 모두 무효화되어 새 설정으로 재합성됨.
const TTS_VERSION = 1;
const VOICE = 'nova';
const MODEL = 'gpt-4o-mini-tts';

// 운동 종류별 톤. mode 가 hash 와 storage 키에 포함되어 같은 텍스트도 mode 별로 캐시 분리.
type TtsMode = 'main' | 'stretch';
const INSTRUCTIONS_BY_MODE: Record<TtsMode, string> = {
  main: '친근하고 활기찬 운동 코치 톤으로 말해주세요. 너무 빠르지 않고 정확한 발음으로, 사용자를 응원하듯 따뜻하게.',
  stretch: '편안하고 명상적인 톤으로 말해주세요. 천천히 부드럽게 안내하듯.',
};
function parseMode(raw: unknown): TtsMode {
  return raw === 'stretch' ? 'stretch' : 'main';
}

const BUCKET = 'tts-audio';
const MAX_TEXT_LENGTH = 500;

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, 405);
  }

  let body: { text?: string; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const text = (body.text ?? '').trim();
  if (!text) return json({ error: 'text required' }, 400);
  if (text.length > MAX_TEXT_LENGTH) {
    return json({ error: `text too long (max ${MAX_TEXT_LENGTH})` }, 400);
  }

  const mode = parseMode(body.mode);
  const instructions = INSTRUCTIONS_BY_MODE[mode];

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'supabase env missing' }, 500);
  if (!openaiKey) return json({ error: 'OPENAI_API_KEY missing' }, 500);

  const supabase = createClient(supabaseUrl, serviceKey);
  // mode 도 해시에 포함 → 같은 텍스트라도 mode 가 다르면 별도 캐시 저장.
  const hash = await sha256Hex(`${text}:${TTS_VERSION}:${mode}`);

  // 1) 캐시 조회
  const { data: cached, error: lookupErr } = await supabase
    .from('tts_cache')
    .select('audio_url')
    .eq('text_hash', hash)
    .maybeSingle();

  if (lookupErr) {
    return json({ error: `cache lookup failed: ${lookupErr.message}` }, 500);
  }

  if (cached?.audio_url) {
    // last_used_at 업데이트 (실패 무시 — 조회는 이미 성공)
    supabase
      .from('tts_cache')
      .update({ last_used_at: new Date().toISOString() })
      .eq('text_hash', hash)
      .then(() => undefined);
    return json({ audio_url: cached.audio_url, cached: true });
  }

  // 2) OpenAI TTS 호출
  const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      voice: VOICE,
      input: text,
      instructions,
      response_format: 'mp3',
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    return json({ error: `OpenAI ${openaiRes.status}: ${errText.slice(0, 200)}` }, 502);
  }

  const audioBuf = new Uint8Array(await openaiRes.arrayBuffer());

  // 3) Storage 업로드 (upsert 로 동시성 안전)
  const filePath = `${hash}.mp3`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, audioBuf, {
      contentType: 'audio/mpeg',
      upsert: true,
      cacheControl: '31536000', // 1 year — 캐시 절대 안 바뀜
    });

  if (uploadErr) {
    return json({ error: `upload failed: ${uploadErr.message}` }, 500);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  const audioUrl = urlData.publicUrl;

  // 4) tts_cache upsert
  const { error: insertErr } = await supabase
    .from('tts_cache')
    .upsert(
      {
        text_hash: hash,
        text,
        audio_url: audioUrl,
        tts_version: TTS_VERSION,
      },
      { onConflict: 'text_hash' },
    );

  if (insertErr) {
    // 캐시 insert 실패해도 audio_url 자체는 정상 — 클라이언트엔 반환, 다음 호출에서 다시 시도됨.
    console.warn(`cache upsert failed: ${insertErr.message}`);
  }

  return json({ audio_url: audioUrl, cached: false });
});
