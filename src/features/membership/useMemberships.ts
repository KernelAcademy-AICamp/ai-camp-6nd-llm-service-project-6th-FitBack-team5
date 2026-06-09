import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export type MembershipType = 'free' | 'session' | 'class';
export type MembershipPeriod = 'month' | '3month' | '6month' | '12month';
export type MembershipStatus = 'active' | 'expired';

/** Raw row as stored in public.memberships (snake_case). */
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
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    cost: row.cost,
    period: row.period,
    startDate: row.start_date,
    endDate: row.end_date,
    maxVisits: row.max_visits,
    status: deriveStatus(row.end_date),
  };
}

/**
 * Loads the current user's memberships. RLS already scopes rows to the
 * signed-in user; the explicit user_id filter keeps the query key honest and
 * the result tidy. Disabled until a session exists.
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
        .select('*')
        .eq('user_id', user.id)
        .order('end_date', { ascending: false });
      if (error) throw error;
      return (data as MembershipRow[]).map(toMembership);
    },
  });
}
