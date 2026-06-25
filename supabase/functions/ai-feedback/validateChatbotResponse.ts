/**
 * FitBack 핏쌤 챗봇 — 응답 검증기
 *
 * Claude가 반환한 raw 텍스트를 받아 JSON 파싱 + 스키마 검증을 수행합니다.
 * 의존성 없음(zod 등 불필요) — Deno Edge Function / RN 양쪽에서 그대로 사용.
 *
 * 역할: 프롬프트 "내용"이 바뀌어도 출력이 계약(chatbot.types.ts)을 지키는지
 *       이 검증기가 잡아줍니다. 깨지면 조용히 통과시키지 않고 ok:false로 명확히 실패.
 */

import type {
  ChatbotResponse,
  ChatbotIntent,
  FollowupActionType,
  ValidationResult,
} from "./chatbot.types.ts";

const INTENTS: ChatbotIntent[] = ["plan", "diet", "photo", "general"];
const FOLLOWUP_TYPES: FollowupActionType[] = [
  "log_workout", "view_plan", "view_diet", "log_meal", "book_session", "ask_question",
];

/** 모델이 코드펜스(```json ... ```)를 붙였을 때 제거 */
function stripFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function isStr(v: unknown): v is string {
  return typeof v === "string";
}
function isNum(v: unknown): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** intent별 body 검증. 통과하면 null, 실패하면 에러 메시지 반환. */
function validateBody(intent: ChatbotIntent, body: unknown): string | null {
  if (!isObj(body)) return "body가 객체가 아닙니다";

  switch (intent) {
    case "plan": {
      if (!isStr(body.focus_part)) return "plan.focus_part 누락";
      if (!Array.isArray(body.items)) return "plan.items가 배열이 아닙니다";
      if (!isNum(body.duration_min)) return "plan.duration_min 누락";
      for (const it of body.items) {
        if (!isObj(it) || !isStr(it.name) || !isNum(it.sets) || !isNum(it.reps))
          return "plan.items 항목 형식 오류 (name/sets/reps)";
      }
      return null;
    }
    case "diet": {
      if (!isNum(body.target_kcal)) return "diet.target_kcal 누락";
      if (!isNum(body.protein_g)) return "diet.protein_g 누락";
      if (!Array.isArray(body.meals)) return "diet.meals가 배열이 아닙니다";
      for (const m of body.meals) {
        if (!isObj(m) || !isStr(m.time) || !isStr(m.menu) || !isNum(m.kcal))
          return "diet.meals 항목 형식 오류 (time/menu/kcal)";
      }
      return null;
    }
    case "photo": {
      if (!Array.isArray(body.foods)) return "photo.foods가 배열이 아닙니다";
      if (!isNum(body.total_kcal)) return "photo.total_kcal 누락";
      if (!isStr(body.comment)) return "photo.comment 누락";
      for (const f of body.foods) {
        if (!isObj(f) || !isStr(f.name) || !isNum(f.est_kcal) || !isNum(f.protein_g))
          return "photo.foods 항목 형식 오류 (name/est_kcal/protein_g)";
      }
      return null;
    }
    case "general": {
      if (!isStr(body.answer)) return "general.answer 누락";
      return null;
    }
  }
}

/**
 * Claude raw 응답 텍스트 → 검증된 ChatbotResponse 또는 에러.
 * 사용처: ai-feedback Edge Function에서 모델 응답을 앱에 내보내기 전에 호출.
 */
export function validateChatbotResponse(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, error: "JSON 파싱 실패" };
  }

  if (!isObj(parsed)) return { ok: false, error: "응답이 객체가 아닙니다" };

  const { intent, summary, coach_message, caution, followup, body } = parsed;

  if (!isStr(intent) || !INTENTS.includes(intent as ChatbotIntent))
    return { ok: false, error: `intent 값 오류: ${String(intent)}` };
  if (!isStr(summary)) return { ok: false, error: "summary 누락" };
  if (!isStr(coach_message)) return { ok: false, error: "coach_message 누락" };
  if (caution !== null && !isStr(caution))
    return { ok: false, error: "caution은 문자열 또는 null이어야 합니다" };
  if (
    !isObj(followup) ||
    !isStr(followup.type) ||
    !FOLLOWUP_TYPES.includes(followup.type as FollowupActionType) ||
    !isStr(followup.label)
  ) return { ok: false, error: "followup 형식 오류 — { type, label } 객체 필요" };

  const bodyError = validateBody(intent as ChatbotIntent, body);
  if (bodyError) return { ok: false, error: bodyError };

  return { ok: true, data: parsed as ChatbotResponse };
}
