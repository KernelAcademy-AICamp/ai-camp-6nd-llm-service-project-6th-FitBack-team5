import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCreateExerciseRecord } from '@/features/membership/useCreateExerciseRecord';

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

export function ExerciseRecordForm({
  visitId,
  onDone,
  onSkip,
}: {
  visitId: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [part, setPart] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<string | null>(null);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const { mutate, isPending, error } = useCreateExerciseRecord();

  const canSubmit = part != null && !isPending;

  function save() {
    if (!part) return;
    mutate(
      {
        visitId,
        exercisePart: part,
        intensity,
        duration: duration ? Number(duration) : null,
        notes: notes.trim() || null,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <View style={styles.wrap}>
      <ThemedText type="h2">운동 기록</ThemedText>

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
          style={[styles.input, focused === 'duration' && styles.inputFocused]}
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          메모
        </ThemedText>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onFocus={() => setFocused('notes')}
          onBlur={() => setFocused(null)}
          placeholder="예: 스쿼트 5x5, 벤치프레스"
          placeholderTextColor={Palette.gray300}
          style={[styles.input, focused === 'notes' && styles.inputFocused]}
        />
      </View>

      {error ? (
        <ThemedText type="caption" style={styles.error}>
          저장 실패: {(error as Error).message}
        </ThemedText>
      ) : null}

      <Button label="운동 기록 저장" onPress={save} loading={isPending} disabled={!canSubmit} />
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
