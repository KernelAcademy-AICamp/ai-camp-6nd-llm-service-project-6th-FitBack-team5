import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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
      <ThemedText type="subtitle">운동 기록</ThemedText>

      <View style={styles.field}>
        <ThemedText type="small" style={styles.label}>
          부위 *
        </ThemedText>
        <View style={styles.grid}>
          {PARTS.map((p) => (
            <Pressable
              key={p.value}
              onPress={() => setPart(p.value)}
              style={[styles.chip, part === p.value && styles.chipOn]}>
              <ThemedText type={part === p.value ? 'smallBold' : 'small'}>{p.label}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <ThemedText type="small" style={styles.label}>
          강도
        </ThemedText>
        <View style={styles.row}>
          {INTENSITIES.map((it) => (
            <Pressable
              key={it.value}
              onPress={() => setIntensity((v) => (v === it.value ? null : it.value))}
              style={[styles.seg, intensity === it.value && styles.chipOn]}>
              <ThemedText type={intensity === it.value ? 'smallBold' : 'small'}>{it.label}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <ThemedText type="small" style={styles.label}>
          시간 (분)
        </ThemedText>
        <TextInput
          value={duration}
          onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          placeholder="예: 40"
          placeholderTextColor="#9aa"
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="small" style={styles.label}>
          메모
        </ThemedText>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="예: 스쿼트 5x5, 벤치프레스"
          placeholderTextColor="#9aa"
          style={styles.input}
        />
      </View>

      {error ? (
        <ThemedText type="small" style={styles.error}>
          저장 실패: {(error as Error).message}
        </ThemedText>
      ) : null}

      <Pressable
        onPress={save}
        disabled={!canSubmit}
        style={({ pressed }) => [styles.primary, !canSubmit && styles.primaryDim, pressed && canSubmit && styles.pressed]}>
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText type="smallBold" style={styles.primaryLabel}>
            운동 기록 저장
          </ThemedText>
        )}
      </Pressable>
      <Pressable onPress={onSkip} style={styles.skip} hitSlop={8}>
        <ThemedText type="small" style={styles.dim}>
          기록 없이 닫기
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  field: { gap: Spacing.two },
  label: { opacity: 0.7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
  },
  seg: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
  },
  chipOn: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: '#22c55e' },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
    minHeight: 44,
  },
  error: { color: '#d33' },
  primary: {
    backgroundColor: '#22c55e',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryDim: { backgroundColor: '#bbb' },
  pressed: { opacity: 0.85 },
  primaryLabel: { color: '#fff' },
  skip: { alignItems: 'center', paddingVertical: Spacing.two },
  dim: { opacity: 0.6 },
});
