// '회원권 활용도' 목표 기준 회수 계산 (명세 v1.1 §3.3/§3.4).
// 핵심 프레임: "내가 낸 돈을 목표(=원금 75%) 기준으로 얼마나 되찾았나"(상승). risk 모델과 별개.
// 순수 함수 — Membership 객체에 의존하지 않게 정규화 입력만 받는다.

export type PortfolioType = 'session' | 'period';

/** 목표 기준 비율 — 100%(완주)의 분모. Phase1 단일 75%(완주 부담 완화). Phase2 차등 검토. */
export const GOAL_RATIO = 0.75;
/** 단계 마라톤 마커. */
export const STAGE_MARKERS = [25, 50, 75, 100] as const;

export interface PortfolioInput {
  type: PortfolioType;
  principal: number; // 원금(결제액)
  visitCount: number; // 누적 방문(사용) 횟수
  // 인세권
  totalSessions?: number | null;
  // 기간권
  weeklyGoal?: number | null;
  totalWeeks?: number | null;
}

export interface PortfolioValue {
  perVisitValue: number; // 회당 가치
  goalVisits: number; // 목표 방문 횟수(원금 75% 기준)
  goalValue: number; // 목표 가치(진행 바 분모, 100% 기준)
  recovered: number; // 되찾은 누적(=방문×회당)
  progressPct: number; // 목표 대비 % (100 초과분 = 보너스)
  remaining: number; // 목표까지 남은 금액 (>=0)
  bonus: number; // 목표 초과분 (>=0, 100% 초과 시만)
  stage: 0 | 25 | 50 | 75 | 100; // 달성 단계(마커 통과 기준)
  isComplete: boolean; // 목표(100%) 달성
}

/** 시작~종료 사이 주(週) 수 (기간권 totalWeeks 폴백 계산). */
export function weeksBetween(startISO: string, endISO: string): number {
  const s = new Date(`${startISO}T00:00:00Z`).getTime();
  const e = new Date(`${endISO}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((e - s) / (7 * 86_400_000)));
}

/** 회당 가치 — 인세권: 원금/총횟수 · 기간권: 원금/(주목표×주수). 분모 0 가드.
 *  기간권에 주목표 없이 maxVisits만 있으면 인세권 방식으로 폴백. */
export function perVisitValue(p: PortfolioInput): number {
  if (p.type === 'session') {
    const total = p.totalSessions ?? 0;
    return total > 0 ? Math.round(p.principal / total) : 0;
  }
  const weeklyDenom = (p.weeklyGoal ?? 0) * (p.totalWeeks ?? 0);
  if (weeklyDenom > 0) return Math.round(p.principal / weeklyDenom);
  const total = p.totalSessions ?? 0;
  return total > 0 ? Math.round(p.principal / total) : 0;
}

/** 목표 방문 횟수 — 전체의 GOAL_RATIO(75%)에 해당하는 방문 수(반올림). */
export function goalVisits(p: PortfolioInput): number {
  const weeklyTotal = (p.weeklyGoal ?? 0) * (p.totalWeeks ?? 0);
  const totalVisits =
    p.type === 'session'
      ? p.totalSessions ?? 0
      : weeklyTotal > 0
        ? weeklyTotal
        : p.totalSessions ?? 0;
  return Math.round(totalVisits * GOAL_RATIO);
}

function stageOf(progressPct: number): PortfolioValue['stage'] {
  if (progressPct >= 100) return 100;
  if (progressPct >= 75) return 75;
  if (progressPct >= 50) return 50;
  if (progressPct >= 25) return 25;
  return 0;
}

/** 한 회원권의 목표 회수 지표. */
export function computePortfolio(p: PortfolioInput): PortfolioValue {
  const per = perVisitValue(p);
  const gVisits = goalVisits(p);
  const goalValue = gVisits * per;
  const recovered = Math.max(0, p.visitCount) * per;
  const progressPct = goalValue > 0 ? (recovered / goalValue) * 100 : 0;
  const remaining = Math.max(goalValue - recovered, 0);
  const bonus = Math.max(recovered - goalValue, 0);
  return {
    perVisitValue: per,
    goalVisits: gVisits,
    goalValue,
    recovered,
    progressPct,
    remaining,
    bonus,
    stage: stageOf(progressPct),
    isComplete: progressPct >= 100,
  };
}

export interface PortfolioSummary {
  recovered: number; // 되찾은 누적 합 (만료 제외)
  goalValue: number; // 목표 가치 합
  remaining: number; // 목표까지 남은 합
  progressPct: number; // 합산 진행률
  stage: PortfolioValue['stage'];
  bonus: number;
}

/**
 * 포트폴리오 합산(헤더 카드). 명세 §3.5:
 *  - 만료(expired) 회원권은 합산에서 제외
 *  - 합산엔 '실제 되찾은 현금(이득)'만 더한다(기간권 '정체' 금액은 개별 카드에서만 표기, 합산 미포함)
 */
export function summarizePortfolio(items: { value: PortfolioValue; expired: boolean }[]): PortfolioSummary {
  const active = items.filter((x) => !x.expired);
  const recovered = active.reduce((s, x) => s + x.value.recovered, 0);
  const goalValue = active.reduce((s, x) => s + x.value.goalValue, 0);
  const remaining = active.reduce((s, x) => s + x.value.remaining, 0);
  const bonus = active.reduce((s, x) => s + x.value.bonus, 0);
  const progressPct = goalValue > 0 ? (recovered / goalValue) * 100 : 0;
  return { recovered, goalValue, remaining, progressPct, stage: stageOf(progressPct), bonus };
}
