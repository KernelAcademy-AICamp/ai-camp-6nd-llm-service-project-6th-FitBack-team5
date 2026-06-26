/**
 * FitBack — ai-feedback Edge Function (Deno / Supabase) 통합 버전
 *
 * 기존 ai-feedback 함수의 "응답 검증 + 고정 폴백" 단계를 붙인 패턴입니다.
 * 핵심: Claude 응답을 앱으로 그대로 내보내지 않고, validateChatbotResponse를
 * 통과한 데이터만 반환합니다. 2회까지 재시도하고, 모두 실패하면 고정 폴백 응답을
 * 반환해 앱이 항상 정상적으로 화면을 그릴 수 있게 합니다.
 */

import { SYSTEM_PROMPT } from "./systemPrompt.ts";
import { validateChatbotResponse } from "./validateChatbotResponse.ts";
import { FALLBACK_RESPONSE } from "./fallbackResponse.ts";
import type { AppResponse, ChatbotResponse, RoiInfo } from "./chatbot.types.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

interface ChatbotRequest {
  userContext: Record<string, unknown>; // 온보딩 프로필 + 운동목표
  roi?: RoiInfo | null;                 // 프론트에서 계산한 ROI (AI가 생성 금지)
  userMessage?: string;                 // 사용자 질문
  questionAnswer?: string;             // 질문지 답변
  photoAnalysis?: unknown;             // analyze-meal 결과 (사진인 경우)
  history?: { role: string; text: string }[]; // 멀티턴 — 직전 대화(최근 N턴)
}

/** Claude 호출 → raw 텍스트 + 재시도 가능 여부 반환 */
async function callClaude(userPayload: string): Promise<{ text: string; retryable: boolean }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0.4,
      // 시스템 프롬프트는 매 호출 동일 → 프롬프트 캐싱(ephemeral)으로 입력 토큰 비용 절감
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userPayload }],
    }),
  });
  const data = await res.json();
  const text = (data?.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n");
  // 4xx(크레딧 부족·잘못된 요청)는 재시도해도 같은 실패 → 재시도 안 함. 429·5xx·네트워크만 재시도.
  const retryable = res.ok || res.status === 429 || res.status >= 500;
  return { text, retryable };
}

/**
 * 검증 통과한 ChatbotResponse를 반환.
 * 2회까지 재시도하고 모두 실패하면 고정 폴백(FALLBACK_RESPONSE)을 반환한다.
 * → 절대 throw하지 않으므로 앱은 항상 렌더링 가능한 응답을 받는다.
 */
async function getValidatedResponse(payload: string): Promise<ChatbotResponse> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text: raw, retryable } = await callClaude(payload);
      const result = validateChatbotResponse(raw);
      if (result.ok) return result.data;
      console.error(`[ai-feedback] 검증 실패(시도 ${attempt}): ${result.error}`);
      if (!retryable) break; // 비재시도성 오류(4xx)면 즉시 폴백 — 재시도 토큰 낭비 방지
    } catch (err) {
      console.error(`[ai-feedback] 호출 실패(시도 ${attempt}): ${(err as Error).message}`);
    }
  }
  return FALLBACK_RESPONSE;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  let body: ChatbotRequest;
  try {
    body = (await req.json()) as ChatbotRequest;
  } catch {
    console.error("[ai-feedback] 잘못된 요청 본문");
    return new Response(JSON.stringify(FALLBACK_RESPONSE), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const roi = body.roi ?? null;

  const payload = JSON.stringify({
    profile: body.userContext,
    roi,                               // AI는 인용만, 생성 금지
    message: body.userMessage ?? null,
    answer: body.questionAnswer ?? null,
    photo: body.photoAnalysis ?? null,
    history: body.history ?? null,     // 멀티턴 맥락
  });

  const chatResponse = await getValidatedResponse(payload);
  const appResponse: AppResponse = { ...chatResponse, roi };

  return new Response(JSON.stringify(appResponse), {
    headers: { ...CORS, "content-type": "application/json" },
  });
});
