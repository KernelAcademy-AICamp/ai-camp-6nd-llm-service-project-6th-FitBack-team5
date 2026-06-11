// Edge Function: ai-feedback
// 식약처(FOOD_SAFETY) API 조회 + Claude로 운동/식단 피드백 생성 (시작용 스캐폴드)
//
// 로컬 실행:  npx supabase functions serve ai-feedback --env-file .env
// 배포:       npx supabase functions deploy ai-feedback
// secrets:    npx supabase secrets set FOOD_SAFETY_API_KEY=... ANTHROPIC_API_KEY=...
//
// 앱에서 호출:
//   const { data, error } = await supabase.functions.invoke('ai-feedback', {
//     body: { food: '닭가슴살' },
//   });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // 비밀 키는 Edge Function 환경에서만 읽음 (클라이언트에 절대 노출 안 됨)
  const FOOD_SAFETY_API_KEY = Deno.env.get('FOOD_SAFETY_API_KEY');
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!FOOD_SAFETY_API_KEY || !ANTHROPIC_API_KEY) {
    return json({ error: 'Missing FOOD_SAFETY_API_KEY or ANTHROPIC_API_KEY secret' }, 500);
  }

  let payload: { food?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const food = (payload.food ?? '').trim();
  if (!food) return json({ error: 'body.food 가 필요합니다' }, 400);

  // 1) 식약처 API로 영양정보 조회 (엔드포인트/파라미터는 발급받은 API 문서에 맞게 조정)
  //    예시: 식품영양성분 DB. 실제 URL/쿼리는 팀에서 쓰는 API에 맞춰 교체하세요.
  let nutrition: unknown = null;
  try {
    const url =
      `https://apis.data.go.kr/1471000/FoodNtrIrdntInfoService1/getFoodNtrItdntList1` +
      `?serviceKey=${encodeURIComponent(FOOD_SAFETY_API_KEY)}` +
      `&desc_kor_nm=${encodeURIComponent(food)}&type=json&numOfRows=1&pageNo=1`;
    const res = await fetch(url);
    if (res.ok) nutrition = await res.json();
  } catch (e) {
    console.error('food-safety fetch failed', e);
  }

  // 2) Claude로 친근한 코치 톤의 피드백 생성 (design.md Voice & Tone 반영)
  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:
        'You are FitBack, a friendly AI fitness coach. 사용자를 평가하지 말고, ' +
        '데이터를 보여주고, 다음 행동을 담백하고 친근하게 제안하라. 공포감·죄책감 유발 금지.',
      messages: [
        {
          role: 'user',
          content:
            `음식: ${food}\n영양정보(JSON): ${JSON.stringify(nutrition)}\n` +
            `이 음식에 대한 짧은 운동/식단 피드백을 1~2문장으로 한국어로 작성해줘.`,
        },
      ],
    }),
  });

  if (!claudeRes.ok) {
    const detail = await claudeRes.text();
    return json({ error: 'Claude API error', detail }, 502);
  }

  const claude = await claudeRes.json();
  const feedback = claude?.content?.[0]?.text ?? '';

  return json({ food, nutrition, feedback });
});
