/**
 * ai-feedback Edge Function 응답 타입 — 프론트엔드 사본
 * Edge Function의 supabase/functions/ai-feedback/chatbot.types.ts와 동기 유지.
 * 구조 변경 시 양쪽 + validateChatbotResponse + systemPrompt [CONTRACT] 모두 수정.
 */

export type ChatbotIntent = 'plan' | 'diet' | 'photo' | 'general';

export type FollowupActionType =
  | 'log_workout'
  | 'view_plan'
  | 'view_diet'
  | 'log_meal'
  | 'book_session'
  | 'ask_question';

export interface FollowupAction {
  type: FollowupActionType;
  label: string;
}

export interface PlanItem { name: string; sets: number; reps: number }
export interface PlanBody { focus_part: string; items: PlanItem[]; duration_min: number }

export interface DietMeal { time: string; menu: string; kcal: number }
export interface DietBody { target_kcal: number; protein_g: number; meals: DietMeal[] }

export interface PhotoFood { name: string; est_kcal: number; protein_g: number }
export interface PhotoBody { foods: PhotoFood[]; total_kcal: number; comment: string }

export interface GeneralBody { answer: string }

interface BaseResponse {
  summary: string;
  coach_message: string;
  caution: string | null;
  followup: FollowupAction;
}

export interface PlanResponse extends BaseResponse { intent: 'plan'; body: PlanBody }
export interface DietResponse extends BaseResponse { intent: 'diet'; body: DietBody }
export interface PhotoResponse extends BaseResponse { intent: 'photo'; body: PhotoBody }
export interface GeneralResponse extends BaseResponse { intent: 'general'; body: GeneralBody }

export type ChatbotResponse = PlanResponse | DietResponse | PhotoResponse | GeneralResponse;

export interface RoiInfo {
  utilization_pct: number;
  days_left: number;
  pace_status: 'behind' | 'on_track' | 'ahead';
  value_at_risk: number;
}

export type AppResponse = ChatbotResponse & { roi: RoiInfo | null };
