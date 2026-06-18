/**
 * FitBack — 질문지 UI (React Native)
 *
 * intent별 선택지(세로) + 기타 직접입력 지원.
 * - diet: 감량 / 유지 / 증량
 * - plan: 상체 / 하체 / 전신 + 기타(텍스트 입력)
 * - photo / general: 질문 불필요 → null 반환
 */

import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Spacing } from '@/constants/theme';

export type ChatbotIntent = 'plan' | 'diet' | 'photo' | 'general';

export const INTENT_QUESTIONS: Record<
  ChatbotIntent,
  { prompt: string; options?: string[] } | null
> = {
  diet: { prompt: '오늘 목표가 뭔가요?', options: ['감량', '유지', '증량'] },
  plan: { prompt: '오늘 집중하고 싶은 부위를 알려주세요?', options: ['상체', '하체', '전신'] },
  photo: null,
  general: null,
};

interface Props {
  intent: ChatbotIntent;
  onAnswer: (answer: string) => void;
}

export function IntentQuestion({ intent, onAnswer }: Props) {
  const q = INTENT_QUESTIONS[intent];
  const [showCustom, setShowCustom] = useState(false);
  const [text, setText] = useState('');

  if (!q) return null;

  // diet: 선택지만 (기타 없음)
  if (!q.options) return null;

  if (showCustom) {
    return (
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="예: 허벅지, 등, 어깨 (없으면 비워두세요)"
          placeholderTextColor={Palette.gray300}
          onSubmitEditing={() => onAnswer(text.trim())}
          returnKeyType="done"
          autoFocus
        />
        <Pressable
          style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
          onPress={() => onAnswer(text.trim())}
          accessibilityRole="button">
          <ThemedText type="captionBold" style={styles.submitText}>
            {text.trim() ? '이걸로 받기' : '추천받기'}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {q.options.map((opt) => (
        <Pressable
          key={opt}
          style={({ pressed }) => [styles.optionBtn, pressed && styles.pressed]}
          onPress={() => onAnswer(opt)}
          accessibilityRole="button">
          <ThemedText type="captionBold" style={styles.optionText}>
            {opt}
          </ThemedText>
        </Pressable>
      ))}
      <Pressable
        style={({ pressed }) => [styles.optionBtn, styles.otherBtn, pressed && styles.pressed]}
        onPress={() => setShowCustom(true)}
        accessibilityRole="button">
        <ThemedText type="captionBold" style={styles.otherText}>
          기타 직접입력
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  optionBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    backgroundColor: Palette.bgSurface,
    alignItems: 'center',
  },
  otherBtn: {
    borderStyle: 'dashed',
    borderColor: Palette.gray300,
  },
  pressed: { opacity: 0.6 },
  optionText: { color: Palette.gray900 },
  otherText: { color: Palette.gray500 },
  input: {
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    color: Palette.gray900,
    backgroundColor: Palette.bgSurface,
  },
  submitBtn: {
    paddingVertical: Spacing.sm,
    borderRadius: Radius.small,
    alignItems: 'center',
    backgroundColor: Palette.primary,
  },
  submitText: { color: Palette.bgSurface },
});
