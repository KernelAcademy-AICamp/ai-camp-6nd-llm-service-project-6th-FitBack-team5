/**
 * FitBack AI 피트니스 챗봇 — 응답 스키마 타입
 *
 * ⚠️ CONTRACT (계약): 이 파일은 챗봇 응답의 "고정 계약"입니다.
 * 시스템 프롬프트, 검증기(validateChatbotResponse), 질문지 UI가 모두 이 타입에 의존합니다.
 * 프롬프트 "내용"만 바꾸는 작업은 이 파일을 건드리지 않습니다.
 * intent 추가 / body 필드 추가처럼 "구조"를 바꿀 때만 이 파일 + 검증기 + UI를 함께 수정합니다.
 */

export type ChatbotIntent = "plan" | "diet" | "photo" | "general";

// —— 행동 유도(followup) 액션 ————————————————————————
// "사용자가 실제로 운동하러 가게 만드는가"를 측정하려면 followup이 추적 가능해야 한다.
// 자유 텍스트(string) 대신 type(추적용 enum) + label(버튼 문구)로 구조화한다.
export type FollowupActionType =
  | "log_workout" // 오늘 운동 기록하기
  | "view_plan"   // 추천 플랜 보기
  | "view_diet"   // 식단 보기
  | "log_meal"    // 식사 기록 / 사진 올리기
  | "book_session" // 회원권 예약(PT 등)
  | "ask_question"; // 대화 이어가기 / 추가 질문

export interface FollowupAction {
  type: FollowupActionType; // 앱이 라우팅·전환 로깅에 사용 (고정 enum)
  label: string;            // 버튼에 보일 문구 (모델이 작성)
}

// —— intent별 body 구조 ————————————————————————————

export interface PlanItem {
  name: string;
  sets: number;
  reps: number;
  /** RAG-lite: 운동 라이브러리(exercise_candidates)에서 고른 근거 운동명. 못 고르면 생략. */
  source?: string;
}
export interface PlanBody {
  focus_part: string;
  items: PlanItem[];
  duration_min: number;
}

export interface DietMeal {
  time: string;
  menu: string;
  kcal: number;
}
export interface DietBody {
  target_kcal: number;
  protein_g: number;
  meals: DietMeal[];
}

export interface PhotoFood {
  name: string;
  est_kcal: number;
  protein_g: number;
}
export interface PhotoBody {
  foods: PhotoFood[];
  total_kcal: number;
  comment: string;
}

export interface GeneralBody {
  answer: string;
}

// —— 공통 필드 + intent별 discriminated union ————————

interface BaseResponse {
  summary: string;
  coach_message: string;
  caution: string | null;
  followup: FollowupAction; // ⭐ string → FollowupAction (추적 가능한 행동 유도)
}

export interface PlanResponse extends BaseResponse {
  intent: "plan";
  body: PlanBody;
}
export interface DietResponse extends BaseResponse {
  intent: "diet";
  body: DietBody;
}
export interface PhotoResponse extends BaseResponse {
  intent: "photo";
  body: PhotoBody;
}
export interface GeneralResponse extends BaseResponse {
  intent: "general";
  body: GeneralBody;
}

/** 챗봇이 반환하는 최종 응답. intent로 분기하면 body 타입이 자동 좁혀집니다. */
export type ChatbotResponse =
  | PlanResponse
  | DietResponse
  | PhotoResponse
  | GeneralResponse;

// —— ROI (서버 계산, AI가 생성하지 않음) ————————————

export interface RoiInfo {
  utilization_pct: number;            // 0–100
  days_left: number;                  // 만료까지 남은 일수
  pace_status: "behind" | "on_track" | "ahead";
  value_at_risk: number;              // 만료 시 소멸 금액(원)
}

/** Edge Function이 앱에 최종 반환하는 타입 (ChatbotResponse + roi) */
export type AppResponse = ChatbotResponse & { roi: RoiInfo | null };

/** 검증기 반환 타입 */
export type ValidationResult =
  | { ok: true; data: ChatbotResponse }
  | { ok: false; error: string };