import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  Elevation,
  MaxContentWidth,
  Radius,
  ScreenPaddingX,
  Spacing,
} from '@/constants/theme';
import { Routine, useGenerateRoutine } from '@/features/workout/useGenerateRoutine';
import { useTheme } from '@/hooks/use-theme';

const goals = ['체력 향상', '체중 감량', '자세 개선'] as const;
const places = ['집', '야외', '헬스장'] as const;
const equipments = ['매트', '없음', '덤벨'] as const;
const conditions = ['좋음', '보통', '피곤해요'] as const;
const bodyParts = ['없음', '무릎', '허리'] as const;
const durations = ['10분', '15분', '20분'] as const;

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chipGroup}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? theme.primary : theme.backgroundMuted,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: active ? '#FFFFFF' : theme.textBody }}>
              {opt}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function OptionRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.optionRow}>
      <ThemedText
        type="smallBold"
        themeColor="textBody"
        style={styles.optionLabel}
        numberOfLines={1}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

export default function WorkoutScreen() {
  const theme = useTheme();
  const [goal, setGoal] = useState<(typeof goals)[number]>('체력 향상');
  const [place, setPlace] = useState<(typeof places)[number]>('집');
  const [equipment, setEquipment] = useState<(typeof equipments)[number]>('매트');
  const [condition, setCondition] = useState<(typeof conditions)[number]>('보통');
  const [bodyPart, setBodyPart] = useState<(typeof bodyParts)[number]>('없음');
  const [duration, setDuration] = useState<(typeof durations)[number]>('15분');
  const [recommendation, setRecommendation] = useState<Routine | null>(null);
  const { mutate: generate, isPending, error } = useGenerateRoutine();

  const hasResult = recommendation !== null;

  function handleGenerate() {
    generate(
      { goal, place, equipment, condition, bodyPart, duration },
      { onSuccess: setRecommendation },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="title">오늘의 운동</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              오늘 컨디션과 시간에 맞춰 10~20분 홈트를 추천해드릴게요
            </ThemedText>
          </View>

          <ThemedView
            type="backgroundElement"
            style={[styles.formCard, { borderColor: theme.lineDefault }, Elevation.level1]}>
            <OptionRow label="운동 목표">
              <ChipGroup options={goals} value={goal} onChange={setGoal} />
            </OptionRow>
            <OptionRow label="운동 장소">
              <ChipGroup options={places} value={place} onChange={setPlace} />
            </OptionRow>
            <OptionRow label="사용 장비">
              <ChipGroup options={equipments} value={equipment} onChange={setEquipment} />
            </OptionRow>
            <OptionRow label="오늘 컨디션">
              <ChipGroup options={conditions} value={condition} onChange={setCondition} />
            </OptionRow>
            <OptionRow label="불편한 부위">
              <ChipGroup options={bodyParts} value={bodyPart} onChange={setBodyPart} />
            </OptionRow>
            <OptionRow label="가능 시간">
              <ChipGroup options={durations} value={duration} onChange={setDuration} />
            </OptionRow>
          </ThemedView>

          <Pressable
            onPress={handleGenerate}
            disabled={isPending}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: hasResult
                  ? theme.backgroundMuted
                  : pressed
                    ? theme.primaryPressed
                    : theme.primary,
                opacity: isPending ? 0.7 : 1,
              },
            ]}>
            {isPending ? (
              <ActivityIndicator color={hasResult ? theme.text : '#FFFFFF'} />
            ) : (
              <ThemedText
                type="subtitle"
                style={{ color: hasResult ? theme.text : '#FFFFFF' }}>
                {hasResult ? 'AI 루틴 다시 생성하기' : 'AI 루틴 생성하기'}
              </ThemedText>
            )}
          </Pressable>

          {error && (
            <ThemedText type="small" themeColor="error">
              {error instanceof Error ? error.message : '루틴 생성에 실패했어요.'}
            </ThemedText>
          )}

          {recommendation && (
            <ThemedView
              type="backgroundElement"
              style={[
                styles.resultCard,
                { borderColor: theme.lineDefault },
                Elevation.level1,
              ]}>
              <View style={[styles.aiBadge, { backgroundColor: theme.primaryLight }]}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  AI 추천
                </ThemedText>
              </View>

              <ThemedText type="subtitle">{recommendation.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {recommendation.meta}
              </ThemedText>
              <ThemedText type="default" themeColor="textBody">
                {recommendation.intro}
              </ThemedText>

              <View style={styles.exerciseList}>
                {recommendation.exercises.map((ex, idx) => (
                  <View
                    key={ex.name}
                    style={[
                      styles.exerciseRow,
                      idx !== 0 && {
                        borderTopColor: theme.lineDefault,
                        borderTopWidth: StyleSheet.hairlineWidth,
                      },
                    ]}>
                    <View
                      style={[
                        styles.exerciseNum,
                        { backgroundColor: theme.primaryLight },
                      ]}>
                      <ThemedText type="smallBold" style={{ color: theme.primary }}>
                        {idx + 1}
                      </ThemedText>
                    </View>
                    <ThemedText
                      type="default"
                      themeColor="textBody"
                      style={styles.exerciseName}>
                      {ex.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {ex.detail}
                    </ThemedText>
                  </View>
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: pressed ? theme.primaryPressed : theme.primary,
                  },
                ]}>
                <ThemedText type="subtitle" style={{ color: '#FFFFFF' }}>
                  운동 시작하기
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.ghostButton,
                  { opacity: pressed ? 0.6 : 1 },
                ]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  더 쉬운 루틴으로 바꾸기
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContent: {
    paddingHorizontal: ScreenPaddingX,
    paddingTop: Spacing.lg,
    paddingBottom: BottomTabInset + Spacing.lg,
    gap: Spacing.md,
  },
  header: { gap: Spacing.xs },
  formCard: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionLabel: {
    width: 84,
  },
  chipGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  chip: {
    flex: 1,
    minHeight: 36,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    height: 52,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  aiBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.small,
  },
  exerciseList: {
    marginTop: Spacing.xs,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  exerciseNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseName: { flex: 1 },
  ghostButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
