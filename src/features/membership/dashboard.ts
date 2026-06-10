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

// ── spec: 회원권 위험 통계 ────────────────────────────────
export type RiskLevel = 'danger' | 'warning' | 'safe' | 'neutral';

export const RISK_COLORS: Record<RiskLevel, string> = {
  danger: '#EF4444',
  warning: '#F97316',
  safe: '#10B981',
  neutral: '#6B7280',
};

// 색 단독 의존 금지(접근성): 아이콘 + 텍스트 라벨 + 색 3중 표기.
export const RISK_META: Record<RiskLevel, { icon: string; label: string }> = {
  danger: { icon: '🔴', label: '위험' },
  warning: { icon: '🟠', label: '주의' },
  safe: { icon: '🟢', label: '안전' },
  neutral: { icon: '⚪', label: '일반' },
};

const WEEKS_PER_MONTH = 4.3;

export interface RiskInfo {
  level: RiskLevel;
  hasSessions: boolean;
  totalSessions: number | null;
  usedSessions: number;
  remainingSessions: number | null;
  remainingDays: number;
  costPerSession: number;
  valueUsed: number;
  valueAtRisk: number;
  /** 만료 전 다 쓰려면 주당 필요한 방문(횟수제만, 올림). */
  requiredWeeklyPace: number | null;
  sessionFilledRatio: number; // 사용/전체 (0~1)
  periodFilledRatio: number; // 경과/전체 기간 (0~1)
}

/** spec 3장: 페이스 기반 위험. 분모 0 가드. free(횟수 없음)는 neutral. */
export function computeRisk(m: Membership, visitsThisMonth: number): RiskInfo {
  const remainingDays = Math.max(0, daysLeft(m.endDate));
  const hasSessions = m.maxVisits != null;
  const total = m.maxVisits;
  const used = m.usedVisits;
  const remaining = m.remainingVisits;
  const costPerSession = hasSessions && total ? Math.round(m.cost / total) : 0;
  const valueUsed = hasSessions && total ? Math.round(used * (m.cost / total)) : 0;
  const valueAtRisk =
    hasSessions && total && remaining != null ? Math.round(remaining * (m.cost / total)) : 0;

  const startMs = Date.parse(`${m.startDate}T00:00:00Z`);
  const endMs = Date.parse(`${m.endDate}T00:00:00Z`);
  const totalSpan = Math.max(1, (endMs - startMs) / 86_400_000);
  const periodFilledRatio = Math.min(1, Math.max(0, (totalSpan - remainingDays) / totalSpan));
  const sessionFilledRatio = hasSessions && total ? Math.min(1, Math.max(0, used / total)) : 0;

  let level: RiskLevel;
  let requiredWeeklyPace: number | null = null;

  if (remainingDays <= 0) {
    level = 'danger'; // 만료
  } else if (!hasSessions) {
    level = 'neutral'; // 자유이용권: 못 쓰는 횟수 개념 없음
  } else if (remaining === 0) {
    level = 'safe'; // 다 씀
  } else {
    const requiredPace = (remaining as number) / (remainingDays / 7);
    const actualPace = visitsThisMonth / WEEKS_PER_MONTH;
    const ratio = requiredPace > 0 ? actualPace / requiredPace : 1;
    requiredWeeklyPace = Math.ceil(requiredPace);
    if (ratio < 0.7) level = 'danger';
    else if (ratio < 1.0) level = 'warning';
    else level = 'safe';
  }

  return {
    level,
    hasSessions,
    totalSessions: total,
    usedSessions: used,
    remainingSessions: remaining,
    remainingDays,
    costPerSession,
    valueUsed,
    valueAtRisk,
    requiredWeeklyPace,
    sessionFilledRatio,
    periodFilledRatio,
  };
}

export interface RiskSummary {
  danger: number;
  warning: number;
  safe: number;
  neutral: number;
  totalAtRisk: number;
}

export function summarize(risks: RiskInfo[]): RiskSummary {
  const s: RiskSummary = { danger: 0, warning: 0, safe: 0, neutral: 0, totalAtRisk: 0 };
  for (const r of risks) {
    s[r.level] += 1;
    s.totalAtRisk += r.valueAtRisk;
  }
  return s;
}

const RISK_ORDER: Record<RiskLevel, number> = { danger: 0, warning: 1, neutral: 2, safe: 3 };

/** 위험순 정렬: danger→warning→neutral→safe, 같은 레벨은 손실액 큰 순. */
export function sortByRisk<T>(items: T[], riskOf: (t: T) => RiskInfo): T[] {
  return [...items].sort((a, b) => {
    const ra = riskOf(a);
    const rb = riskOf(b);
    if (RISK_ORDER[ra.level] !== RISK_ORDER[rb.level]) return RISK_ORDER[ra.level] - RISK_ORDER[rb.level];
    return rb.valueAtRisk - ra.valueAtRisk;
  });
}
