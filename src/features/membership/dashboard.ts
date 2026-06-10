import type { Membership } from './useMemberships';

// PART 2 홈 대시보드 계산 helper.

/** 회원권 활용 기준: 회당 20,000원 (문서값). */
export const BREAK_EVEN_PER_VISIT = 20000;

export const PART_LABELS: Record<string, string> = {
  chest: '가슴',
  back: '등',
  legs: '하체',
  shoulder: '어깨',
  core: '코어',
  arms: '팔',
  cardio: '유산소',
  fullbody: '전신',
};

export function partLabel(part: string): string {
  return PART_LABELS[part] ?? part;
}

/**
 * 회당 비용:
 *  - session/class(횟수 계약): 비용 ÷ 계약 횟수 (고정)
 *  - free(자유): 비용 ÷ 실제 방문 수 (가변) — 방문 0이면 아직 산정 불가(null)
 */
export function perVisitCost(m: Membership): number | null {
  if (m.type !== 'free' && m.maxVisits) return Math.round(m.cost / m.maxVisits);
  if (m.usedVisits > 0) return Math.round(m.cost / m.usedVisits);
  return null;
}

/** 회원권 활용까지 남은 방문 횟수 = ceil(비용 ÷ 20,000) − 지금까지 방문. 음수면 활용 완료. */
export function breakEvenRemaining(m: Membership): number {
  return Math.ceil(m.cost / BREAK_EVEN_PER_VISIT) - m.usedVisits;
}

/** 신호등: 1회 이하 초록(거의/달성), 2~5 노랑, 6+ 빨강. */
export function breakEvenColor(remaining: number): string {
  if (remaining <= 1) return '#22c55e';
  if (remaining <= 5) return '#f59e0b';
  return '#ef4444';
}

/** 종료일까지 남은 일수 (UTC 자정 기준, 타임존 영향 없음). 음수면 만료. */
export function daysLeft(endDate: string): number {
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  const now = new Date();
  const todayMid = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((end - todayMid) / 86_400_000);
}

/** 대시보드 상단에 띄울 대표 회원권: 사용중인 것 우선, 없으면 첫 번째. */
export function pickPrimary(memberships: Membership[]): Membership | null {
  if (memberships.length === 0) return null;
  return memberships.find((m) => m.status === 'active') ?? memberships[0];
}

/** 1,000 단위마다 쉼표 (정수부 기준). 예: 10000 → "10,000" */
export function formatNumber(n: number): string {
  const neg = n < 0;
  const s = Math.abs(Math.trunc(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return neg ? `-${s}` : s;
}

/** 원화 표기: ₩10,000 */
export function won(n: number): string {
  return `₩${formatNumber(n)}`;
}
