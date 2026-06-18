import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { formatNumber } from '@/features/membership/dashboard';
import { useCreateExerciseRecord } from '@/features/membership/useCreateExerciseRecord';
import type { MembershipType } from '@/features/membership/useMemberships';

const PARTS: { value: string; label: string }[] = [
  { value: 'chest', label: '가슴' },
  { value: 'back', label: '등' },
  { value: 'legs', label: '하체' },
  { value: 'shoulder', label: '어깨' },
  { value: 'core', label: '코어' },
  { value: 'arms', label: '팔' },
  { value: 'cardio', label: '유산소' },
  { value: 'fullbody', label: '전신' },
];

const INTENSITIES: { value: string; label: string }[] = [
  { value: 'easy', label: '쉬움' },
  { value: 'normal', label: '보통' },
  { value: 'hard', label: '힘듦' },
];

/** PART 4: 회원권 형태별 운동 기록.
 * - 자유이용권(free): 부위/강도/시간
 * - 세션권(session, PT): 트레이너명 + 남은 세션
 * - 예약권(class): 클래스명 + 시간
 * 형태별 부가정보는 auto_data(jsonb)에 저장. */
export function ExerciseRecordForm({
  visitId,
  membershipType,
  remainingVisits,
  onDone,
  onSkip,
}: {
  visitId: string;
  membershipType: MembershipType;
  remainingVisits?: number | null;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [part, setPart] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<string | null>(null);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [trainer, setTrainer] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const { mutate, isPending, error } = useCreateExerciseRecord();

  const isPeriod = membershipType === 'period';
  const isSession = membershipType === 'session';

  // 기간권만 부위 필수. 인세권(PT)은 방문(출석)만으로도 기록 가능.
  const canSubmit = (!isPeriod || part != null) && !isPending;

  function save() {
    const durationNum = duration ? Number(duration) : null;
    const autoData = isSession
      ? { kind: 'session', trainer: trainer.trim() || null, status: '세션 완료' }
      : { kind: 'free', status: '운동 완료' };
    mutate(
      {
        visitId,
        exercisePart: isPeriod ? part : null,
        intensity: isPeriod ? intensity : null,
        duration: durationNum,
        notes: notes.trim() || null,
        autoData,
      },
      { onSuccess: onDone },
    );
  }

  const inputStyle = (key: string) => [styles.input, focused === key && styles.inputFocused];

  return (
    <View style={styles.wrap}>
      <ThemedText type="h2">
        {isSession ? 'PT 세션 기록' : '운동 기록'}
      </ThemedText>
      {isSession && (
        <ThemedText type="caption" themeColor="textSecondary">
          수고하셨습니다!{isSession && remainingVisits != null ? ` 남은 세션 ${formatNumber(remainingVisits)}회` : ''}
        </ThemedText>
      )}

      {/* 자유이용권: 부위 (필수) */}
      {isPeriod && (
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <ThemedText type="label" themeColor="textSecondary">
              부위
            </ThemedText>
            <ThemedText type="label" style={styles.required}> *</ThemedText>
          </View>
          <View style={styles.grid}>
            {PARTS.map((p) => {
              const on = part === p.value;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => setPart(p.value)}
                  style={[styles.chip, on && styles.chipOn]}>
                  <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>
                    {p.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* 자유이용권: 강도 */}
      {isPeriod && (
        <View style={styles.field}>
          <ThemedText type="label" themeColor="textSecondary">
            강도
          </ThemedText>
          <View style={styles.row}>
            {INTENSITIES.map((it) => {
              const on = intensity === it.value;
              return (
                <Pressable
                  key={it.value}
                  onPress={() => setIntensity((v) => (v === it.value ? null : it.value))}
                  style={[styles.seg, on && styles.chipOn]}>
                  <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>
                    {it.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* 세션권(PT): 트레이너명 */}
      {isSession && (
        <View style={styles.field}>
          <ThemedText type="label" themeColor="textSecondary">
            담당 트레이너 (선택)
          </ThemedText>
          <TextInput
            value={trainer}
            onChangeText={setTrainer}
            onFocus={() => setFocused('trainer')}
            onBlur={() => setFocused(null)}
            placeholder="예: 김코치"
            placeholderTextColor={Palette.gray300}
            style={inputStyle('trainer')}
          />
        </View>
      )}

      {/* 공통: 시간 (기간권은 의미 큼, PT는 선택) */}
      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          시간 (분)
        </ThemedText>
        <TextInput
          value={duration}
          onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ''))}
          onFocus={() => setFocused('duration')}
          onBlur={() => setFocused(null)}
          keyboardType="numeric"
          placeholder="예: 40"
          placeholderTextColor={Palette.gray300}
          style={inputStyle('duration')}
        />
      </View>

      {/* 공통: 메모 */}
      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          메모
        </ThemedText>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onFocus={() => setFocused('notes')}
          onBlur={() => setFocused(null)}
          placeholder={isSession ? '예: 하체 집중, 데드리프트' : '예: 스쿼트 5x5'}
          placeholderTextColor={Palette.gray300}
          style={inputStyle('notes')}
        />
      </View>

      {error ? (
        <ThemedText type="caption" style={styles.error}>
          저장 실패: {(error as Error).message}
        </ThemedText>
      ) : null}

      <Button
        label={isSession ? '세션 기록 저장' : '운동 기록 저장'}
        onPress={save}
        loading={isPending}
        disabled={!canSubmit}
      />
      <Pressable onPress={onSkip} style={styles.skip} hitSlop={8}>
        <ThemedText type="caption" themeColor="textSecondary">
          기록 없이 닫기
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  field: { gap: Spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  required: { color: Palette.loss },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Palette.gray100,
  },
  seg: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.small,
    backgroundColor: Palette.gray100,
  },
  chipOn: { backgroundColor: Palette.primaryLight },
  activeText: { color: Palette.primary },
  input: {
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    fontFamily: 'Pretendard',
    color: Palette.gray900,
    backgroundColor: Palette.gray100,
    minHeight: 52,
  },
  inputFocused: { borderColor: Palette.primary, backgroundColor: Palette.primaryLight },
  error: { color: Palette.error },
  skip: { alignItems: 'center', paddingVertical: Spacing.sm },
});
