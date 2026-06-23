import { AlertCircle, AlertTriangle, Minus, TrendingUp, type LucideIcon } from 'lucide-react-native';

import { Palette } from '@/constants/theme';

import type { Membership } from './useMemberships';

/** 종료일까지 남은 일수 (UTC 자정 기준, 타임존 영향 없음). 음수면 만료. */
export function daysLeft(endDate: string): number {
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  const now = new Date();
  const todayMid = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((end - todayMid) / 86_400_000);
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

// 위험도 = 회원권 ROI 손익 개념 → 디자인 손익 컬러(적자/흑자) + 시맨틱.
export const RISK_COLORS: Record<RiskLevel, string> = {
  danger: Palette.loss, // 적자(못 쓰면 손실)
  warning: Palette.warning,
  safe: Palette.profit, // 흑자(페이스 충분)
  neutral: Palette.gray500,
};

// 색 단독 의존 금지(접근성): 아이콘 + 텍스트 라벨 + 색 3중 표기 (Lucide).
export const RISK_META: Record<RiskLevel, { icon: LucideIcon; label: string }> = {
  danger: { icon: AlertTriangle, label: '위험' },
  warning: { icon: AlertCircle, label: '주의' },
  safe: { icon: TrendingUp, label: '안전' },
  neutral: { icon: Minus, label: '일반' },
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
  /** 실제/필요 페이스 비율. 낮을수록 급함(1순위 정렬용). 횟수제·만료전만 값, 그 외 null. */
  paceRatio: number | null;
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
  let paceRatio: number | null = null;

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
    paceRatio = ratio;
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
    paceRatio,
    sessionFilledRatio,
    periodFilledRatio,
  };
}

export interface RiskSummary {
  danger: number;
  warning: number;
  safe: number;
  neutral: number;
  /** 만료 전 위험 회원권에서 아직 살릴 수 있는 금액(행동 가능) → 히어로. */
  recoverable: number;
  /** 이미 만료된 회원권의 잃은 금액(복구 불가) → 회색 보조. */
  lost: number;
  /** 이번 달 사용가치(긍정 강화) → 성공색 보조. */
  valueUsedThisMonth: number;
  /** 가장 급한(페이스 최저) 위험 회원권 이름 — CTA 부제. */
  topPriorityName: string | null;
  /** 위 회원권을 만료 전 다 쓰려면 주당 필요한 방문 횟수. */
  topPriorityPace: number | null;
}

/** spec 4-A.2: 살릴 수 있는 돈/이미 잃은 돈/사용가치 분리 집계 + 1순위 도출. */
export function summarize(
  items: { risk: RiskInfo; monthlyVisits: number; name: string }[],
): RiskSummary {
  const s: RiskSummary = {
    danger: 0,
    warning: 0,
    safe: 0,
    neutral: 0,
    recoverable: 0,
    lost: 0,
    valueUsedThisMonth: 0,
    topPriorityName: null,
    topPriorityPace: null,
  };
  let topPace = Infinity;
  for (const { risk: r, monthlyVisits, name } of items) {
    s[r.level] += 1;
    s.valueUsedThisMonth += monthlyVisits * r.costPerSession;
    const expired = r.remainingDays <= 0 && (r.remainingSessions ?? 0) > 0;
    if (expired) {
      s.lost += r.valueAtRisk; // 복구 불가
    } else if (r.level === 'danger') {
      s.recoverable += r.valueAtRisk; // 아직 살릴 수 있음
      const pace = r.paceRatio ?? 0;
      if (pace < topPace) {
        topPace = pace;
        s.topPriorityName = name;
        s.topPriorityPace = r.requiredWeeklyPace;
      }
    }
  }
  return s;
}

/** D-day 배지 표시값 — 라벨(D-N / 만료) + 색(페이스 3단계: 위험/주의/안전, 그 외 회색). */
export function ddayBadge(risk: RiskInfo): { label: string; color: string } {
  const expired = risk.remainingDays <= 0;
  const color = expired
    ? Palette.gray300
    : risk.level === 'danger'
      ? RISK_COLORS.danger
      : risk.level === 'warning'
        ? RISK_COLORS.warning
        : risk.level === 'safe'
          ? RISK_COLORS.safe
          : Palette.gray500;
  return { label: expired ? '만료' : `D-${formatNumber(risk.remainingDays)}`, color };
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
