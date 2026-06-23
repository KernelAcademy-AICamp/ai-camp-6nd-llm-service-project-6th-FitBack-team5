import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

// 명세 v1.1: 2종화 — session(인세권: 정해진 횟수) / period(기간권: 무제한·주당 목표).
export type MembershipType = 'session' | 'period';
export type MembershipPeriod = 'month' | '3month' | '6month' | '12month';
export type MembershipInputMethod = 'manual' | 'receipt_scan';
// 명세 §4: ACTIVE / EXPIRING(D-7) / EXPIRED
export type MembershipStatus = 'active' | 'expiring' | 'expired';

/** 만료 임박 기준 (명세 §4: D-7 고정). */
export const EXPIRING_DAYS = 7;

/** Raw row from public.memberships (snake_case) + visit-count aggregate. */
export interface MembershipRow {
  id: string;
  user_id: string;
  name: string;
  cost: number;
  period: MembershipPeriod;
  start_date: string; // 'YYYY-MM-DD'
  end_date: string; // 'YYYY-MM-DD'
  type: MembershipType;
  max_visits: number | null; // 인세권 총 횟수(totalSessions)
  weekly_goal: number | null; // 기간권 주당 목표 방문
  input_method: MembershipInputMethod | null;
  created_at: string;
  // PostgREST aggregate over the visits FK → [{ count: N }] (empty-safe).
  visits: { count: number }[];
}

/** View model consumed by the membership screen (camelCase). */
export interface Membership {
  id: string;
  name: string;
  type: MembershipType;
  cost: number;
  period: MembershipPeriod;
  startDate: string;
  endDate: string;
  maxVisits: number | null; // 인세권 총 횟수
  weeklyGoal: number | null; // 기간권 주당 목표
  inputMethod: MembershipInputMethod | null;
  createdAt: string; // 등록 시각(최신 등록순 정렬용)
  usedVisits: number;
  /** max_visits - used, clamped at 0. null when unlimited (period, or no cap). */
  remainingVisits: number | null;
  status: MembershipStatus;
}

/** 남은 일수 (오늘 기준, 만료 시 음수). */
export function daysUntil(endDate: string): number {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - today) / 86_400_000);
}

/** 파생 상태: 만료(end<오늘) / 임박(D-7 이내) / 활성. 저장하지 않고 매번 계산. */
function deriveStatus(endDate: string): MembershipStatus {
  const d = daysUntil(endDate);
  if (d < 0) return 'expired';
  if (d <= EXPIRING_DAYS) return 'expiring';
  return 'active';
}

function toMembership(row: MembershipRow): Membership {
  const usedVisits = row.visits?.[0]?.count ?? 0;
  const remainingVisits =
    row.max_visits != null ? Math.max(0, row.max_visits - usedVisits) : null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    cost: row.cost,
    period: row.period,
    startDate: row.start_date,
    endDate: row.end_date,
    maxVisits: row.max_visits,
    weeklyGoal: row.weekly_goal ?? null,
    inputMethod: row.input_method ?? null,
    createdAt: row.created_at,
    usedVisits,
    remainingVisits,
    status: deriveStatus(row.end_date),
  };
}

/**
 * Loads the current user's memberships with their visit counts. The count
 * comes from the visits FK aggregate (`visits(count)`), so "남은 횟수"
 * = max_visits - used. RLS scopes both memberships and visits to the
 * signed-in user. Disabled until a session exists.
 */
export function useMemberships() {
  const user = useCurrentUser();
  return useQuery<Membership[]>({
    queryKey: ['memberships', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('memberships')
        .select('*, visits(count)')
        .eq('user_id', user.id)
        .order('end_date', { ascending: false });
      if (error) throw error;
      return (data as MembershipRow[]).map(toMembership);
    },
  });
}
