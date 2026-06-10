import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  computeEndDate,
  isValidDate,
  useCreateMembership,
} from '@/features/membership/useCreateMembership';
import type { MembershipPeriod, MembershipType } from '@/features/membership/useMemberships';

const PERIODS: { value: MembershipPeriod; label: string }[] = [
  { value: 'month', label: '1개월' },
  { value: '3month', label: '3개월' },
  { value: '6month', label: '6개월' },
  { value: '12month', label: '12개월' },
];

const TYPES: { value: MembershipType; label: string; desc: string }[] = [
  { value: 'free', label: '자유이용권', desc: '언제든 이용 (무제한)' },
  { value: 'session', label: '세션권 (PT)', desc: '정해진 횟수만 이용' },
  { value: 'class', label: '예약권 (클래스)', desc: '클래스 예약제' },
];

function todayISO(): string {
  // 로컬 기준 오늘 (UTC 변환으로 날짜가 밀리지 않게 직접 조합)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" style={styles.fieldLabel}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

export function MembershipForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [period, setPeriod] = useState<MembershipPeriod>('month');
  const [startDate, setStartDate] = useState(todayISO());
  const [type, setType] = useState<MembershipType>('free');
  const [maxVisits, setMaxVisits] = useState('');

  const { mutate, isPending, error } = useCreateMembership();

  const showVisits = type !== 'free'; // STEP 5: session/class만 횟수 입력
  const costNum = Number(cost);
  const visitsNum = Number(maxVisits);
  const dateOk = isValidDate(startDate);

  const canSubmit =
    name.trim().length > 0 &&
    cost.length > 0 &&
    !Number.isNaN(costNum) &&
    costNum >= 0 &&
    dateOk &&
    (!showVisits || (maxVisits.length > 0 && Number.isInteger(visitsNum) && visitsNum > 0)) &&
    !isPending;

  function handleSubmit() {
    if (!canSubmit) return;
    mutate(
      { name, cost: costNum, period, startDate, type, maxVisits: showVisits ? visitsNum : null },
      { onSuccess: onClose },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle">회원권 등록</ThemedText>
        <Pressable onPress={onClose} hitSlop={8}>
          <ThemedText type="default">닫기</ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* STEP 3: 회원권 기본 정보 */}
        <Field label="회원권명">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="예: 강남 PT 30회"
            placeholderTextColor="#9aa"
            style={styles.input}
          />
        </Field>

        <Field label="비용 (원)">
          <TextInput
            value={cost}
            onChangeText={setCost}
            keyboardType="numeric"
            placeholder="예: 360000"
            placeholderTextColor="#9aa"
            style={styles.input}
          />
        </Field>

        <Field label="결제 기간">
          <View style={styles.segmentRow}>
            {PERIODS.map((p) => (
              <Pressable
                key={p.value}
                onPress={() => setPeriod(p.value)}
                style={[styles.segment, period === p.value && styles.segmentActive]}>
                <ThemedText type={period === p.value ? 'smallBold' : 'small'}>{p.label}</ThemedText>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="시작일 (YYYY-MM-DD)">
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-06-10"
            placeholderTextColor="#9aa"
            autoCapitalize="none"
            style={[styles.input, !dateOk && startDate.length > 0 && styles.inputError]}
          />
          {dateOk && (
            <ThemedText type="small" style={styles.hint}>
              만료일 · {computeEndDate(startDate, period)} (자동 계산)
            </ThemedText>
          )}
        </Field>

        {/* STEP 4: 회원권 형태 */}
        <Field label="회원권 형태">
          <View style={styles.typeCol}>
            {TYPES.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setType(t.value)}
                style={[styles.typeOption, type === t.value && styles.typeOptionActive]}>
                <View style={styles.radioOuter}>
                  {type === t.value && <View style={styles.radioInner} />}
                </View>
                <View style={styles.typeTextCol}>
                  <ThemedText type="smallBold">{t.label}</ThemedText>
                  <ThemedText type="small">{t.desc}</ThemedText>
                </View>
              </Pressable>
            ))}
          </View>
        </Field>

        {/* STEP 5: 형태별 추가 정보 — 횟수 */}
        {showVisits && (
          <Field label={type === 'session' ? '계약 횟수' : '횟수'}>
            <TextInput
              value={maxVisits}
              onChangeText={setMaxVisits}
              keyboardType="numeric"
              placeholder="예: 30"
              placeholderTextColor="#9aa"
              style={styles.input}
            />
          </Field>
        )}

        {error && (
          <ThemedText type="small" style={styles.error}>
            저장 실패: {(error as Error).message}
          </ThemedText>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submit,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && styles.submitPressed,
          ]}>
          {isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText type="smallBold" style={styles.submitLabel}>
              등록하기
            </ThemedText>
          )}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  body: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  field: { gap: Spacing.two },
  fieldLabel: { opacity: 0.7 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#d33' },
  hint: { opacity: 0.7 },
  segmentRow: { flexDirection: 'row', gap: Spacing.two },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
  },
  segmentActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: '#22c55e',
  },
  typeCol: { gap: Spacing.two },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
  },
  typeOptionActive: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: '#22c55e',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  typeTextCol: { flex: 1, gap: 2 },
  error: { color: '#d33' },
  submit: {
    marginTop: Spacing.two,
    backgroundColor: '#111',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  submitDisabled: { backgroundColor: '#bbb' },
  submitPressed: { opacity: 0.85 },
  submitLabel: { color: '#fff' },
});
