import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatNumber } from '@/features/membership/dashboard';
import { DateWheelPicker } from '@/features/membership/DateWheelPicker';
import { recognizeText } from '@/features/membership/ocr';
import { parseReceipt } from '@/features/membership/parseReceipt';
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <ThemedText type="small" style={styles.fieldLabel}>
          {label}
        </ThemedText>
        {required ? <ThemedText style={styles.required}> *</ThemedText> : null}
      </View>
      {children}
      {error ? (
        <ThemedText type="small" style={styles.errorText}>
          {error}
        </ThemedText>
      ) : null}
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const { mutate, isPending, error } = useCreateMembership();
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const showVisits = type !== 'free'; // STEP 5: session/class만 횟수 입력
  const costNum = Number(cost);
  const visitsNum = Number(maxVisits);
  const dateOk = isValidDate(startDate);
  const nameOk = name.trim().length > 0;
  const costOk = cost.length > 0 && !Number.isNaN(costNum) && costNum >= 0;
  const visitsOk =
    !showVisits || (maxVisits.length > 0 && Number.isInteger(visitsNum) && visitsNum > 0);

  const canSubmit = nameOk && costOk && dateOk && visitsOk && !isPending;

  const nameError = touched.name && !nameOk ? '회원권명을 입력해 주세요. (필수)' : null;
  const costError = touched.cost && !costOk ? '비용을 숫자로 입력해 주세요. (필수)' : null;
  const visitsError =
    touched.maxVisits && showVisits && !visitsOk ? '횟수를 1 이상 입력해 주세요. (필수)' : null;

  // 영수증 스캔: 이미지 선택 → OCR → 정규식 파싱 → 폼 프리필 (사용자 확인/수정 전제)
  async function scanReceipt() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
      if (res.canceled) return;
      const text = await recognizeText(res.assets[0].uri);
      const parsed = parseReceipt(text);
      if (parsed.name) setName(parsed.name);
      if (parsed.cost != null) setCost(String(parsed.cost));
      if (parsed.startDate && isValidDate(parsed.startDate)) setStartDate(parsed.startDate);
    } catch (e) {
      const msg = (e as Error).message;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('영수증 스캔', msg);
    }
  }

  function handleSubmit() {
    if (!canSubmit) {
      // 빈 칸 그대로 누르면 어떤 항목이 필수인지 메시지로 표시
      setTouched({ name: true, cost: true, startDate: true, maxVisits: true });
      return;
    }
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
        <Pressable
          onPress={scanReceipt}
          style={({ pressed }) => [styles.scanBtn, pressed && styles.scanBtnPressed]}>
          <ThemedText type="smallBold">📷 영수증으로 자동입력</ThemedText>
        </Pressable>

        {/* STEP 3: 회원권 기본 정보 */}
        <Field label="회원권명" required error={nameError}>
          <TextInput
            value={name}
            onChangeText={setName}
            onBlur={() => touch('name')}
            placeholder="예: 강남 PT 30회"
            placeholderTextColor="#9aa"
            style={[styles.input, nameError && styles.inputError]}
          />
        </Field>

        <Field label="비용 (원)" required error={costError}>
          <TextInput
            value={cost ? formatNumber(Number(cost)) : ''}
            onChangeText={(t) => setCost(t.replace(/[^0-9]/g, ''))}
            onBlur={() => touch('cost')}
            keyboardType="numeric"
            placeholder="예: 360,000"
            placeholderTextColor="#9aa"
            style={[styles.input, costError && styles.inputError]}
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

        {/* STEP 3: 시작일 — 휠 날짜 선택기 */}
        <Field label="시작일" required>
          <Pressable onPress={() => setPickerOpen(true)} style={styles.input}>
            <ThemedText type="default">{startDate}</ThemedText>
          </Pressable>
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
          <Field label={type === 'session' ? '계약 횟수' : '횟수'} required error={visitsError}>
            <TextInput
              value={maxVisits}
              onChangeText={setMaxVisits}
              onBlur={() => touch('maxVisits')}
              keyboardType="numeric"
              placeholder="예: 30"
              placeholderTextColor="#9aa"
              style={[styles.input, visitsError && styles.inputError]}
            />
          </Field>
        )}

        {error && (
          <ThemedText type="small" style={styles.errorText}>
            저장 실패: {(error as Error).message}
          </ThemedText>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={isPending}
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

      <DateWheelPicker
        visible={pickerOpen}
        value={startDate}
        onConfirm={(d) => {
          setStartDate(d);
          touch('startDate');
          setPickerOpen(false);
        }}
        onCancel={() => setPickerOpen(false)}
      />
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
  scanBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  scanBtnPressed: { opacity: 0.7 },
  field: { gap: Spacing.two },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  fieldLabel: { opacity: 0.7 },
  required: { color: '#d33', fontWeight: '700' },
  errorText: { color: '#d33' },
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
    justifyContent: 'center',
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
  segmentActive: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: '#22c55e' },
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
  typeOptionActive: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: '#22c55e' },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' },
  typeTextCol: { flex: 1, gap: 2 },
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
