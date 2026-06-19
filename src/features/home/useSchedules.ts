import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EVENTS, logEvent } from '@/features/analytics/events';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

export type ScheduleType = 'diet' | 'workout' | 'visit' | 'custom';
export type ScheduleSource = 'ai' | 'manual';
export type ScheduleStatus = 'planned' | 'done' | 'skipped';

export interface Schedule {
  id: string;
  date: string; // YYYY-MM-DD
  type: ScheduleType;
  title: string;
  payload: Record<string, unknown> | null;
  source: ScheduleSource;
  status: ScheduleStatus;
}

export interface NewSchedule {
  date: string;
  type: ScheduleType;
  title: string;
  payload?: Record<string, unknown> | null;
  source?: ScheduleSource; // 기본 manual
}

interface ScheduleRow {
  id: string;
  date: string;
  type: ScheduleType;
  title: string;
  payload: Record<string, unknown> | null;
  source: ScheduleSource;
  status: ScheduleStatus;
}

const keyFor = (userId: string | undefined, year: number, month: number) => ['schedules', userId, year, month];

/** 특정 연/월의 예정 일정 조회. 일정 캘린더 그리드/리스트용. */
export function useSchedules(year: number, month: number) {
  const user = useCurrentUser();
  return useQuery<Schedule[]>({
    queryKey: keyFor(user?.id, year, month),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const first = `${year}-${String(month).padStart(2, '0')}-01`;
      const last = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
      const { data, error } = await supabase
        .from('schedules')
        .select('id, date, type, title, payload, source, status')
        .eq('user_id', user!.id)
        .gte('date', first)
        .lte('date', last)
        .order('date', { ascending: true });
      if (error) throw error;
      return (data as ScheduleRow[]).map((r) => ({ ...r }));
    },
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>, userId: string | undefined) {
  qc.invalidateQueries({ queryKey: ['schedules', userId] });
}

/** 일정 추가 (AI 추천 → 일정에 추가 / 수동 입력). */
export function useAddSchedule() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewSchedule): Promise<Schedule> => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const { data, error } = await supabase
        .from('schedules')
        .insert({
          user_id: user.id,
          date: input.date,
          type: input.type,
          title: input.title,
          payload: input.payload ?? null,
          source: input.source ?? 'manual',
        })
        .select('id, date, type, title, payload, source, status')
        .single();
      if (error) throw error;
      return data as Schedule;
    },
    onSuccess: (s) => {
      logEvent(EVENTS.scheduleAdded, { type: s.type, source: s.source });
      invalidateAll(qc, user?.id);
    },
  });
}

export interface ScheduleEdit {
  id: string;
  date?: string;
  type?: ScheduleType;
  title?: string;
  payload?: Record<string, unknown> | null;
  status?: ScheduleStatus;
}

/** 일정 편집 (식단/운동/일정 내용·날짜·상태 수정). */
export function useUpdateSchedule() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (edit: ScheduleEdit): Promise<void> => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const patch: Record<string, unknown> = {};
      if (edit.date !== undefined) patch.date = edit.date;
      if (edit.type !== undefined) patch.type = edit.type;
      if (edit.title !== undefined) patch.title = edit.title;
      if (edit.payload !== undefined) patch.payload = edit.payload;
      if (edit.status !== undefined) patch.status = edit.status;
      const { error } = await supabase.from('schedules').update(patch).eq('id', edit.id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc, user?.id),
  });
}

/** 일정 삭제. */
export function useDeleteSchedule() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const { error } = await supabase.from('schedules').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc, user?.id),
  });
}
