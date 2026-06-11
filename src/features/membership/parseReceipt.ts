export interface ParsedReceipt {
  name?: string;
  cost?: number;
  startDate?: string; // 'YYYY-MM-DD'
}

/**
 * OCR 텍스트에서 회원권 필드를 정규식으로 best-effort 추출.
 * (LLM 보강은 추후) 영수증 형식이 다양해 누락될 수 있으므로 확인/수정 화면이 전제.
 */
export function parseReceipt(text: string): ParsedReceipt {
  const out: ParsedReceipt = {};

  // 금액: 1,200,000 / 1200000 / ₩… / …원 (천단위 쉼표 또는 4자리 이상 숫자)
  const cost = text.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*원?/);
  if (cost) out.cost = Number(cost[1].replace(/,/g, ''));

  // 날짜: 2026-06-10 / 2026.06.10 / 2026/6/10
  const date = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (date) {
    out.startDate = `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`;
  }

  // 이름: 첫 번째 비어있지 않은 줄 (대개 상호명) — 길면 잘라냄
  const first = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean);
  if (first) out.name = first.slice(0, 40);

  return out;
}
