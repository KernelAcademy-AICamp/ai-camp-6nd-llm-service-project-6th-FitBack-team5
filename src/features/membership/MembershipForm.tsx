import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, MapPin, X } from 'lucide-react-native';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { formatNumber } from '@/features/membership/dashboard';
import { DateWheelPicker } from '@/features/membership/DateWheelPicker';
import { getPosition } from '@/features/membership/location';
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
        <ThemedText type="label" themeColor="textSecondary">
          {label}
        </ThemedText>
        {required ? <ThemedText type="label" style={styles.required}> *</ThemedText> : null}
      </View>
      {children}
      {error ? (
        <ThemedText type="caption" style={styles.errorText}>
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
  const [centerName, setCenterName] = useState('');
  const [centerCoord, setCenterCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [focused, setFocused] = useState<string | null>(null);

  const { mutate, isPending, error } = useCreateMembership();
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const showVisits = type !== 'free';
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

  const inputStyle = (key: string, hasError?: boolean) => [
    styles.input,
    focused === key && styles.inputFocused,
    hasError && styles.inputError,
  ];

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

  async function setCenterFromGPS() {
    setGpsLoading(true);
    const p = await getPosition();
    setGpsLoading(false);
    if (p) {
      setCenterCoord(p);
    } else {
      const msg = '현재 위치를 가져올 수 없어요. 위치 권한을 확인해 주세요.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('센터 위치', msg);
    }
  }

  function handleSubmit() {
    if (!canSubmit) {
      setTouched({ name: true, cost: true, startDate: true, maxVisits: true });
      return;
    }
    mutate(
      {
        name,
        cost: costNum,
        period,
        startDate,
        type,
        maxVisits: showVisits ? visitsNum : null,
        centerName: centerName.trim() || null,
        centerLat: centerCoord?.lat ?? null,
        centerLng: centerCoord?.lng ?? null,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="h2">회원권 등록</ThemedText>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
          <Icon icon={X} size={24} color={Palette.gray500} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={scanReceipt}
          style={({ pressed }) => [styles.scanBtn, pressed && styles.pressed]}>
          <Icon icon={Camera} size={20} color={Palette.primary} />
          <ThemedText type="captionBold" style={{ color: Palette.primary }}>
            영수증으로 자동입력
          </ThemedText>
        </Pressable>

        <Field label="회원권명" required error={nameError}>
          <TextInput
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused('name')}
            onBlur={() => {
              setFocused(null);
              touch('name');
            }}
            placeholder="예: 강남 PT 30회"
            placeholderTextColor={Palette.gray300}
            style={inputStyle('name', !!nameError)}
          />
        </Field>

        <Field label="비용 (원)" required error={costError}>
          <TextInput
            value={cost ? formatNumber(Number(cost)) : ''}
            onChangeText={(t) => setCost(t.replace(/[^0-9]/g, ''))}
            onFocus={() => setFocused('cost')}
            onBlur={() => {
              setFocused(null);
              touch('cost');
            }}
            keyboardType="numeric"
            placeholder="예: 360,000"
            placeholderTextColor={Palette.gray300}
            style={inputStyle('cost', !!costError)}
          />
        </Field>

        <Field label="결제 기간">
          <View style={styles.segmentRow}>
            {PERIODS.map((p) => {
              const on = period === p.value;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => setPeriod(p.value)}
                  style={[styles.segment, on && styles.segmentActive]}>
                  <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>
                    {p.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="시작일" required>
          <Pressable onPress={() => setPickerOpen(true)} style={styles.input}>
            <ThemedText type="body">{startDate}</ThemedText>
          </Pressable>
          {dateOk && (
            <ThemedText type="caption" themeColor="textSecondary">
              만료일 · {computeEndDate(startDate, period)} (자동 계산)
            </ThemedText>
          )}
        </Field>

        <Field label="회원권 형태">
          <View style={styles.typeCol}>
            {TYPES.map((t) => {
              const on = type === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => setType(t.value)}
                  style={[styles.typeOption, on && styles.typeOptionActive]}>
                  <View style={[styles.radioOuter, on && styles.radioOuterOn]}>
                    {on && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.typeTextCol}>
                    <ThemedText type="captionBold">{t.label}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {t.desc}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Field>

        {showVisits && (
          <Field label={type === 'session' ? '계약 횟수' : '횟수'} required error={visitsError}>
            <TextInput
              value={maxVisits}
              onChangeText={setMaxVisits}
              onFocus={() => setFocused('maxVisits')}
              onBlur={() => {
                setFocused(null);
                touch('maxVisits');
              }}
              keyboardType="numeric"
              placeholder="예: 30"
              placeholderTextColor={Palette.gray300}
              style={inputStyle('maxVisits', !!visitsError)}
            />
          </Field>
        )}

        <Field label="센터 (선택)">
          <TextInput
            value={centerName}
            onChangeText={setCenterName}
            onFocus={() => setFocused('centerName')}
            onBlur={() => setFocused(null)}
            placeholder="예: 강남 피트니스"
            placeholderTextColor={Palette.gray300}
            style={inputStyle('centerName')}
          />
          <Pressable
            onPress={setCenterFromGPS}
            style={({ pressed }) => [styles.gpsBtn, pressed && styles.pressed]}>
            {gpsLoading ? (
              <ActivityIndicator color={Palette.primary} />
            ) : (
              <>
                <Icon
                  icon={centerCoord ? Check : MapPin}
                  size={16}
                  color={centerCoord ? Palette.profit : Palette.gray500}
                />
                <ThemedText type="caption" themeColor="textSecondary">
                  {centerCoord
                    ? `위치 설정됨 (${centerCoord.lat.toFixed(4)}, ${centerCoord.lng.toFixed(4)})`
                    : '현재 위치를 센터로 설정'}
                </ThemedText>
              </>
            )}
          </Pressable>
        </Field>

        {error && (
          <ThemedText type="caption" style={styles.errorText}>
            저장 실패: {(error as Error).message}
          </ThemedText>
        )}

        <Button
          label="등록하기"
          onPress={handleSubmit}
          loading={isPending}
          disabled={!canSubmit}
          style={styles.submit}
        />
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
  container: { flex: 1, backgroundColor: Palette.bgBase },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.md,
  },
  body: {
    paddingHorizontal: ScreenPadding,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  pressed: { opacity: 0.7 },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    backgroundColor: Palette.bgSurface,
  },
  field: { gap: Spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  required: { color: Palette.loss },
  errorText: { color: Palette.error },
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
    justifyContent: 'center',
  },
  inputFocused: { borderColor: Palette.primary, backgroundColor: Palette.primaryLight },
  inputError: { borderColor: Palette.error },
  segmentRow: { flexDirection: 'row', gap: Spacing.sm },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.small,
    backgroundColor: Palette.gray100,
  },
  segmentActive: { backgroundColor: Palette.primaryLight },
  activeText: { color: Palette.primary },
  typeCol: { gap: Spacing.sm },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    backgroundColor: Palette.bgSurface,
  },
  typeOptionActive: { backgroundColor: Palette.primaryLight, borderColor: Palette.primary },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Palette.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterOn: { borderColor: Palette.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Palette.primary },
  typeTextCol: { flex: 1, gap: 2 },
  submit: { marginTop: Spacing.sm },
});
