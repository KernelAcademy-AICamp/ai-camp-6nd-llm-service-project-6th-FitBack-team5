import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export type MembershipType = 'free' | 'session' | 'class';
export type MembershipPeriod = 'month' | '3month' | '6month' | '12month';
export type MembershipStatus = 'active' | 'expired';

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
  max_visits: number | null;
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
  maxVisits: number | null;
  usedVisits: number;
  /** max_visits - used, clamped at 0. null when unlimited (free, or no cap). */
  remainingVisits: number | null;
  status: MembershipStatus;
}

/**
 * Status is derived, not stored: active while end_date is today-or-later,
 * expired once it's in the past. 'YYYY-MM-DD' strings compare lexically in
 * date order, so no Date parsing is needed for the comparison.
 */
function deriveStatus(endDate: string): MembershipStatus {
  const today = new Date().toISOString().slice(0, 10);
  return endDate >= today ? 'active' : 'expired';
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
