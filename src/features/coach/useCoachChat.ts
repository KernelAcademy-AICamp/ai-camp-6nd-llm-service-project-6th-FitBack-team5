import { useMutation } from '@tanstack/react-query';

// [보류] MY 코치 우선순위 하향으로 현재 CoachChat 화면에서 호출하지 않는다.
//        재개 시 CoachChat.send()에서 이 훅을 mutate로 연결하면 된다. (함수는 보존)
// MY 코치 채팅은 Supabase Edge Function(coach-chat) 프록시를 통해 Claude를 호출(키 서버 보관).
// 단발성: 이전 대화 맥락은 보내지 않고, 질문 + 데이터 컨텍스트만 전달한다.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface CoachChatContext {
  diet?: {
    date: string;
    totalKcal: number;
    carb_g: number;
    protein_g: number;
    fat_g: number;
    tags: string[];
  } | null;
  streakWeeks?: number;
  weekVisits?: number;
  weekWorkouts?: number;
}

export function useCoachChat() {
  return useMutation<string, Error, { question: string; context: CoachChatContext }>({
    mutationFn: async ({ question, context }) => {
      if (!SUPABASE_URL || !ANON) throw new Error('서버 설정이 없어요.');
      const r = await fetch(`${SUPABASE_URL}/functions/v1/coach-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON}`,
          apikey: ANON,
        },
        body: JSON.stringify({ question, context }),
      });
      if (!r.ok) throw new Error('코치 응답을 불러오지 못했어요.');
      const j = (await r.json()) as { text?: string; error?: string };
      if (j.error) throw new Error(j.error);
      return (j.text ?? '').trim();
    },
  });
}
