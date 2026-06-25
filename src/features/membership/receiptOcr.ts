// 회원권 영수증 OCR — Claude Vision Edge Function(receipt-ocr) 호출.
// 웹·네이티브 공통(서버 처리). 사진 base64 → 구조화 필드 { name, cost, startDate }.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface ReceiptFields {
  name?: string;
  cost?: number;
  startDate?: string; // 'YYYY-MM-DD'
}

/** 영수증 사진(base64) → 회원권 필드 추출. 실패 시 throw. */
export async function recognizeReceipt(base64: string, mediaType: string): Promise<ReceiptFields> {
  if (!SUPABASE_URL || !ANON) throw new Error('서버 설정이 없어요.');
  const image = base64.replace(/^data:[^;]+;base64,/, '');
  const r = await fetch(`${SUPABASE_URL}/functions/v1/receipt-ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
    },
    body: JSON.stringify({ image, mediaType }),
  });
  const j = (await r.json()) as ReceiptFields & { error?: string };
  if (!r.ok || j.error) throw new Error(j.error ?? '영수증 인식에 실패했어요.');
  return { name: j.name, cost: j.cost, startDate: j.startDate };
}
