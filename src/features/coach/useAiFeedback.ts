import { useMutation } from '@tanstack/react-query';

import type { AppResponse, RoiInfo } from '@/features/coach/chatbot.types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface AiFeedbackInput {
  userContext: Record<string, unknown>;
  roi?: RoiInfo | null;
  userMessage?: string;
  questionAnswer?: string;
  photoAnalysis?: unknown;
}

export function useAiFeedback() {
  return useMutation<AppResponse, Error, AiFeedbackInput>({
    mutationFn: async (input) => {
      if (!SUPABASE_URL || !ANON) throw new Error('서버 설정이 없어요.');
      const r = await fetch(`${SUPABASE_URL}/functions/v1/ai-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON}`,
          apikey: ANON,
        },
        body: JSON.stringify(input),
      });
      if (!r.ok) throw new Error('AI 코치 응답을 불러오지 못했어요.');
      return r.json() as Promise<AppResponse>;
    },
  });
}
