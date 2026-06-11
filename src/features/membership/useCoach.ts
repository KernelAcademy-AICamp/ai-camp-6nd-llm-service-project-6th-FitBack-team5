import { useQuery } from '@tanstack/react-query';

import { describeWeekday, type VisitPattern } from '@/features/membership/useVisitPattern';
import type { RiskInfo, RiskSummary } from '@/features/membership/dashboard';
import type { Membership } from '@/features/membership/useMemberships';

// AI 코치는 Supabase Edge Function(coach) 프록시를 통해 Claude를 호출한다(키 서버 보관).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface CoachTip {
  headline: string;
  insight: string;
  action: string;
}

export interface CoachInput {
  withRisk: { m: Membership; risk: RiskInfo; visits: number }[];
  summary: RiskSummary;
  monthly: { visitCount: number; byPart: { part: string; count: number }[] } | undefined;
  pattern: VisitPattern | undefined;
}

/** Claude에 보낼 compact 페이로드(개인정보 최소화: 이름·수치 위주). */
function buildPayload(input: CoachInput) {
  return {
    memberships: input.withRisk.map(({ m, risk, visits }) => ({
      name: m.name,
      type: m.type,
      risk: risk.level,
      remaining: risk.remainingSessions,
      total: risk.totalSessions,
      remainingDays: risk.remainingDays,
      costPerSession: risk.costPerSession,
      valueAtRisk: risk.valueAtRisk,
      requiredWeeklyPace: risk.requiredWeeklyPace,
      monthlyVisits: visits,
    })),
    totals: {
      recoverable: input.summary.recoverable,
      lost: input.summary.lost,
      valueUsedThisMonth: input.summary.valueUsedThisMonth,
      topPriority: input.summary.topPriorityName,
    },
    monthly: input.monthly ? { visits: input.monthly.visitCount, byPart: input.monthly.byPart } : null,
    pattern: input.pattern
      ? { weekday: describeWeekday(input.pattern.byWeekday), time: input.pattern.byTimeBucket, total: input.pattern.total }
      : null,
  };
}

/** 입력의 안정적 시그니처 — 같은 데이터면 캐시 재사용(불필요한 호출/비용 방지). */
function signature(p: ReturnType<typeof buildPayload>): string {
  const mem = p.memberships.map((m) => `${m.name}:${m.risk}:${m.remaining}:${m.monthlyVisits}`).join('|');
  return `${mem}#${p.totals.recoverable}#${p.monthly?.visits ?? 0}#${p.pattern?.total ?? 0}`;
}

/** "이번 주 추천" — 회원권 데이터 → Claude 해석+행동. 회원권 없으면 비활성. */
export function useCoach(input: CoachInput) {
  const payload = buildPayload(input);
  const sig = signature(payload);
  return useQuery<CoachTip>({
    queryKey: ['coach', sig],
    enabled: !!SUPABASE_URL && !!ANON && input.withRisk.length > 0,
    staleTime: 1000 * 60 * 60 * 6, // 6시간: 자주 바뀌지 않으니 비용 절약
    retry: 0,
    queryFn: async () => {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON}`,
          apikey: ANON as string,
        },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('코치 추천을 불러오지 못했어요.');
      const j = (await r.json()) as CoachTip & { error?: string };
      if (j.error) throw new Error(j.error);
      return { headline: j.headline, insight: j.insight, action: j.action };
    },
  });
}
