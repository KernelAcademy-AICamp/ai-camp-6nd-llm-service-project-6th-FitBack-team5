/**
 * FitBack — 고정 폴백 응답
 *
 * 모델 호출/검증이 모두 실패했을 때 앱에 내려보내는 "안전 기본 응답"입니다.
 * 스키마(ChatbotResponse)를 그대로 지키므로 앱은 평소처럼 화면을 그립니다.
 * (roi는 서버가 런타임에 붙입니다. AppResponse = ChatbotResponse & { roi })
 *
 * 👷 콘텐츠(문구)는 임시(placeholder)입니다. 톤에 맞게 자유롭게 바꿔도 됩니다.
 *    단, 필드 구조(특히 followup 객체)는 그대로 두세요(계약).
 */

import type { ChatbotResponse } from "./chatbot.types";

export const FALLBACK_RESPONSE: ChatbotResponse = {
  intent: "general",
  summary: "제가 잠깐 숨 좀 골랐어요",
  body: {
    answer: "답을 정리하다 살짝 헛디뎠어요. 한 번만 더 보내주실래요?",
  },
  coach_message: "저는 잠깐 굳었지만 우리 몸은 안 굳게, 이따 가볍게 가봐요!",
  caution: null,
  followup: { type: "ask_question", label: "다시 물어보기" },
};