import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, MapPin, Search } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { formatNumber } from '@/features/membership/dashboard';
import { DateWheelPicker } from '@/features/membership/DateWheelPicker';
import { getPosition } from '@/features/membership/location';
import { recognizeText } from '@/features/membership/ocr';
import { parseReceipt } from '@/features/membership/parseReceipt';
import { searchPlaces, type GeoResult } from '@/features/membership/useGeocode';
import { computeEndDate, isValidDate } from '@/features/membership/useCreateMembership';
import type { MembershipPeriod, MembershipType } from '@/features/membership/useMemberships';
import { useCompleteOnboarding, type FitnessGoal } from '@/features/onboarding/useCompleteOnboarding';
import { queryClient } from '@/lib/queryClient';

type Step = 'info' | 'membership' | 'type' | 'detail' | 'goal' | 'done';

const STEP_ORDER: Step[] = ['info', 'membership', 'type', 'detail', 'goal'];

const PERIODS: { value: MembershipPeriod; label: string }[] = [
  { value: 'month', label: '1개월' },
  { value: '3month', label: '3개월' },
  { value: '6month', label: '6개월' },
  { value: '12month', label: '12개월' },
];

const TYPES: { value: MembershipType; label: string; desc: string; ex: string }[] = [
  { value: 'free', label: '자유이용 (헬스)', desc: '매일 원할 때 언제든 이용 · 정액제(무제한) · 예약 필요 없음', ex: '예) 헬스장 월 36만원' },
  { value: 'session', label: 'PT 세션', desc: '정해진 횟수만 이용 · 예약 1:1 · 횟수 소진까지', ex: '예) PT 4회 36만원' },
  { value: 'class', label: '클래스', desc: '클래스마다 예약 · 무제한 또는 횟수제 · 시간대 선택', ex: '예) 필라테스 월 15만원' },
];

const GOALS: { value: FitnessGoal; label: string }[] = [
  { value: 'fat_loss', label: '체중 감량' },
  { value: 'muscle_gain', label: '근력 향상' },
  { value: 'health', label: '건강 관리' },
  { value: 'body_shape', label: '체형 개선' },
  { value: 'habit', label: '습관 형성' },
];

const SESSION_PRESETS = [4, 8, 16];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>('info');

  // 내 정보(선택)
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  // 회원권
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [period, setPeriod] = useState<MembershipPeriod>('month');
  const [startDate, setStartDate] = useState(todayISO());
  const [pickerOpen, setPickerOpen] = useState(false);
  // 형태
  const [type, setType] = useState<MembershipType | null>(null);
  // 형태별
  const [sessionCount, setSessionCount] = useState(''); // 세션권 횟수
  const [classMode, setClassMode] = useState<'unlimited' | 'count'>('unlimited');
  const [classCount, setClassCount] = useState('');
  // 센터
  const [centerName, setCenterName] = useState('');
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  // 목표(선택)
  const [goal, setGoal] = useState<FitnessGoal | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const { mutate, isPending, error } = useCompleteOnboarding();

  const costNum = Number(cost);
  const dateOk = isValidDate(startDate);
  const membershipOk = name.trim().length > 0 && cost.length > 0 && costNum > 0 && dateOk;
  const detailOk =
    type === 'free'
      ? true
      : type === 'session'
        ? Number(sessionCount) > 0
        : classMode === 'unlimited' || Number(classCount) > 0;

  const inputStyle = (key: string) => [styles.input, focused === key && styles.inputFocused];
  const stepIndex = STEP_ORDER.indexOf(step);

  // 운동 센터만 검색. 0건이면 주소로 직접 검색 안내.
  async function runSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await searchPlaces(q, { sport: true });
      setResults(res);
      if (res.length === 0) setSearchError('운동 센터가 안 보이면 “주소로 검색”으로 직접 등록하세요.');
    } catch {
      setSearchError('검색에 실패했어요.');
    } finally {
      setSearching(false);
    }
  }

  // 폴백: 운동 필터 없이 주소/장소 그대로 검색.
  async function runAddressSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await searchPlaces(q);
      setResults(res);
      if (res.length === 0) setSearchError('검색 결과가 없어요.');
    } catch {
      setSearchError('검색에 실패했어요.');
    } finally {
      setSearching(false);
    }
  }

  // OCR: 영수증 이미지 → 정규식 파싱 → 회원권명/비용/시작일 자동입력.
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
  function pickPlace(r: GeoResult) {
    setCoord({ lat: r.lat, lng: r.lng });
    setCenterName(r.name);
    setResults([]);
    setSearchQuery('');
  }
  async function gps() {
    setGpsLoading(true);
    const p = await getPosition();
    setGpsLoading(false);
    if (p) setCoord(p);
  }

  function submit() {
    if (!type) return;
    const maxVisits =
      type === 'free'
        ? null
        : type === 'session'
          ? Number(sessionCount)
          : classMode === 'unlimited'
            ? null
            : Number(classCount);
    mutate(
      {
        height: height ? Number(height) : null,
        weight: weight ? Number(weight) : null,
        membership: {
          name,
          cost: costNum,
          period,
          startDate,
          type,
          maxVisits,
          centerName: centerName.trim() || null,
          centerLat: coord?.lat ?? null,
          centerLng: coord?.lng ?? null,
        },
        goal,
      },
      { onSuccess: () => setStep('done') },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* 진행 표시 */}
        {step !== 'done' ? (
          <View style={styles.progress}>
            {STEP_ORDER.map((s, i) => (
              <View key={s} style={[styles.dot, i <= stepIndex && styles.dotOn]} />
            ))}
          </View>
        ) : null}

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {step === 'info' ? (
            <>
              <ThemedText type="h1">반가워요!</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                정확한 분석을 위해 기본 정보만 알려주세요. (선택, 나중에 바꿀 수 있어요)
              </ThemedText>
              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">키 (cm)</ThemedText>
                <TextInput
                  value={height}
                  onChangeText={(t) => setHeight(t.replace(/[^0-9.]/g, ''))}
                  onFocus={() => setFocused('h')}
                  onBlur={() => setFocused(null)}
                  keyboardType="numeric"
                  placeholder="예: 168"
                  placeholderTextColor={Palette.gray300}
                  style={inputStyle('h')}
                />
              </View>
              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">몸무게 (kg)</ThemedText>
                <TextInput
                  value={weight}
                  onChangeText={(t) => setWeight(t.replace(/[^0-9.]/g, ''))}
                  onFocus={() => setFocused('w')}
                  onBlur={() => setFocused(null)}
                  keyboardType="numeric"
                  placeholder="예: 58"
                  placeholderTextColor={Palette.gray300}
                  style={inputStyle('w')}
                />
              </View>
              <Button label="다음" onPress={() => setStep('membership')} style={styles.action} />
            </>
          ) : null}

          {step === 'membership' ? (
            <>
              <ThemedText type="h1">회원권을 등록해요</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                정확한 비용을 입력할수록 분석이 정확해져요.
              </ThemedText>
              <Pressable onPress={scanReceipt} style={({ pressed }) => [styles.scanBtn, pressed && styles.pressed]}>
                <Icon icon={Camera} size={20} color={Palette.primary} />
                <ThemedText type="captionBold" style={{ color: Palette.primary }}>
                  영수증으로 자동입력
                </ThemedText>
              </Pressable>
              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">회원권 이름</ThemedText>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocused('n')}
                  onBlur={() => setFocused(null)}
                  placeholder="예: 강남 PT 12개월"
                  placeholderTextColor={Palette.gray300}
                  style={inputStyle('n')}
                />
              </View>
              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">비용 (원)</ThemedText>
                <TextInput
                  value={cost ? formatNumber(Number(cost)) : ''}
                  onChangeText={(t) => setCost(t.replace(/[^0-9]/g, ''))}
                  onFocus={() => setFocused('c')}
                  onBlur={() => setFocused(null)}
                  keyboardType="numeric"
                  placeholder="예: 360,000"
                  placeholderTextColor={Palette.gray300}
                  style={inputStyle('c')}
                />
              </View>
              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">결제 기간</ThemedText>
                <View style={styles.segmentRow}>
                  {PERIODS.map((p) => {
                    const on = period === p.value;
                    return (
                      <Pressable key={p.value} onPress={() => setPeriod(p.value)} style={[styles.segment, on && styles.segOn]}>
                        <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>
                          {p.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">시작일</ThemedText>
                <Pressable onPress={() => setPickerOpen(true)} style={styles.input}>
                  <ThemedText type="body">{startDate}</ThemedText>
                </Pressable>
                {dateOk ? (
                  <ThemedText type="caption" themeColor="textSecondary">
                    만료일 · {computeEndDate(startDate, period)} (자동 계산)
                  </ThemedText>
                ) : null}
              </View>

              {/* 센터(선택) */}
              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">센터 (선택)</ThemedText>
                <TextInput
                  value={centerName}
                  onChangeText={setCenterName}
                  onFocus={() => setFocused('cn')}
                  onBlur={() => setFocused(null)}
                  placeholder="센터 이름"
                  placeholderTextColor={Palette.gray300}
                  style={inputStyle('cn')}
                />
                <View style={styles.searchRow}>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={runSearch}
                    returnKeyType="search"
                    placeholder="주소·장소 검색 (예: 강남 피트니스)"
                    placeholderTextColor={Palette.gray300}
                    style={[styles.input, styles.searchInput]}
                  />
                  <Pressable onPress={runSearch} disabled={searching} style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}>
                    {searching ? <ActivityIndicator color={Palette.white} /> : <Icon icon={Search} size={18} color={Palette.white} />}
                  </Pressable>
                </View>
                {results.map((r, i) => (
                  <Pressable key={`${r.lat}-${r.lng}-${i}`} onPress={() => pickPlace(r)} style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
                    <Icon icon={MapPin} size={14} color={Palette.gray500} />
                    <View style={styles.resultText}>
                      <ThemedText type="captionBold">{r.name}</ThemedText>
                      {r.address ? <ThemedText type="label" themeColor="textSecondary">{r.address}</ThemedText> : null}
                    </View>
                  </Pressable>
                ))}
                {searchError ? (
                  <View style={styles.fallbackRow}>
                    <ThemedText type="caption" themeColor="textSecondary" style={styles.resultText}>
                      {searchError}
                    </ThemedText>
                    <Pressable onPress={runAddressSearch} hitSlop={6}>
                      <ThemedText type="captionBold" style={{ color: Palette.primary }}>주소로 검색</ThemedText>
                    </Pressable>
                  </View>
                ) : null}
                <Pressable onPress={gps} style={({ pressed }) => [styles.gpsBtn, pressed && styles.pressed]}>
                  {gpsLoading ? (
                    <ActivityIndicator color={Palette.primary} />
                  ) : (
                    <>
                      <Icon icon={coord ? Check : MapPin} size={16} color={coord ? Palette.profit : Palette.gray500} />
                      <ThemedText type="caption" themeColor="textSecondary">
                        {coord ? `위치 설정됨 (${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)})` : '현재 위치를 센터로 설정'}
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              </View>

              <Button label="다음" onPress={() => setStep('type')} disabled={!membershipOk} style={styles.action} />
            </>
          ) : null}

          {step === 'type' ? (
            <>
              <ThemedText type="h1">어떤 형태의 회원권인가요?</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                형태에 따라 비용·위험 계산 방식이 달라져요. 하나만 골라주세요.
              </ThemedText>
              {TYPES.map((t) => {
                const on = type === t.value;
                return (
                  <Card key={t.value} onPress={() => setType(t.value)} accentColor={on ? Palette.primary : undefined} style={on ? styles.typeOn : undefined}>
                    <View style={styles.typeHead}>
                      <ThemedText type="h2">{t.label}</ThemedText>
                      {on ? <Icon icon={Check} size={20} color={Palette.primary} /> : null}
                    </View>
                    <ThemedText type="caption" themeColor="textSecondary">{t.desc}</ThemedText>
                    <ThemedText type="label" themeColor="textSecondary">{t.ex}</ThemedText>
                  </Card>
                );
              })}
              <Button label="다음" onPress={() => setStep('detail')} disabled={!type} style={styles.action} />
            </>
          ) : null}

          {step === 'detail' ? (
            <>
              {type === 'free' ? (
                <>
                  <ThemedText type="h1">자유이용권으로 설정했어요</ThemedText>
                  <ThemedText type="body" themeColor="textSecondary">추가 입력은 없어요. 바로 시작할 수 있어요.</ThemedText>
                </>
              ) : null}

              {type === 'session' ? (
                <>
                  <ThemedText type="h1">계약한 횟수는?</ThemedText>
                  <ThemedText type="body" themeColor="textSecondary">회당 비용은 정비용 ÷ 계약 횟수로 계산돼요.</ThemedText>
                  <View style={styles.segmentRow}>
                    {SESSION_PRESETS.map((n) => {
                      const on = sessionCount === String(n);
                      return (
                        <Pressable key={n} onPress={() => setSessionCount(String(n))} style={[styles.segment, on && styles.segOn]}>
                          <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>{n}회</ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    value={sessionCount}
                    onChangeText={(t) => setSessionCount(t.replace(/[^0-9]/g, ''))}
                    onFocus={() => setFocused('sc')}
                    onBlur={() => setFocused(null)}
                    keyboardType="numeric"
                    placeholder="직접 입력 (예: 30)"
                    placeholderTextColor={Palette.gray300}
                    style={inputStyle('sc')}
                  />
                  {Number(sessionCount) > 0 && costNum > 0 ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      회당 비용 · {formatNumber(Math.round(costNum / Number(sessionCount)))}원
                    </ThemedText>
                  ) : null}
                </>
              ) : null}

              {type === 'class' ? (
                <>
                  <ThemedText type="h1">이용 방식은?</ThemedText>
                  <View style={styles.segmentRow}>
                    {(['unlimited', 'count'] as const).map((mode) => {
                      const on = classMode === mode;
                      return (
                        <Pressable key={mode} onPress={() => setClassMode(mode)} style={[styles.segment, on && styles.segOn]}>
                          <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>
                            {mode === 'unlimited' ? '무제한' : '횟수제'}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                  {classMode === 'count' ? (
                    <TextInput
                      value={classCount}
                      onChangeText={(t) => setClassCount(t.replace(/[^0-9]/g, ''))}
                      onFocus={() => setFocused('cc')}
                      onBlur={() => setFocused(null)}
                      keyboardType="numeric"
                      placeholder="횟수 입력 (예: 20)"
                      placeholderTextColor={Palette.gray300}
                      style={inputStyle('cc')}
                    />
                  ) : (
                    <ThemedText type="caption" themeColor="textSecondary">무제한은 횟수 입력이 없어요.</ThemedText>
                  )}
                </>
              ) : null}

              <Button label="다음" onPress={() => setStep('goal')} disabled={!detailOk} style={styles.action} />
            </>
          ) : null}

          {step === 'goal' ? (
            <>
              <ThemedText type="h1">운동 목표가 있나요?</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">맞춤 피드백에 쓰여요. (선택, 나중에 바꿀 수 있어요)</ThemedText>
              <View style={styles.goalGrid}>
                {GOALS.map((g) => {
                  const on = goal === g.value;
                  return (
                    <Pressable key={g.value} onPress={() => setGoal((v) => (v === g.value ? null : g.value))} style={[styles.goalChip, on && styles.segOn]}>
                      <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>{g.label}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              {error ? (
                <ThemedText type="caption" style={styles.error}>저장 실패: {(error as Error).message}</ThemedText>
              ) : null}
              <Button label="완료" onPress={submit} loading={isPending} style={styles.action} />
            </>
          ) : null}

          {step === 'done' ? (
            <View style={styles.doneWrap}>
              <View style={styles.celebrate}>
                <Icon icon={Check} size={32} color={Palette.profit} />
              </View>
              <ThemedText type="h1">준비 완료!</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">이제 시작해볼까요? 회원권을 똑똑하게 챙겨드릴게요.</ThemedText>
              <Button
                label="시작하기"
                onPress={() => queryClient.invalidateQueries({ queryKey: ['profile'] })}
                style={styles.action}
              />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <DateWheelPicker
        visible={pickerOpen}
        value={startDate}
        onConfirm={(d) => {
          setStartDate(d);
          setPickerOpen(false);
        }}
        onCancel={() => setPickerOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgBase },
  safe: { flex: 1 },
  progress: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: ScreenPadding, paddingTop: Spacing.md },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Palette.gray100 },
  dotOn: { backgroundColor: Palette.primary },
  body: { paddingHorizontal: ScreenPadding, paddingVertical: Spacing.lg, gap: Spacing.md },
  field: { gap: Spacing.sm },
  action: { marginTop: Spacing.md },
  pressed: { opacity: 0.7 },
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
  segmentRow: { flexDirection: 'row', gap: Spacing.sm },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.small, backgroundColor: Palette.gray100 },
  segOn: { backgroundColor: Palette.primaryLight },
  activeText: { color: Palette.primary },
  typeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeOn: { backgroundColor: Palette.primaryLight },
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
  fallbackRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchRow: { flexDirection: 'row', gap: Spacing.sm },
  searchInput: { flex: 1, minHeight: 44 },
  searchBtn: { width: 52, borderRadius: Radius.small, backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.small,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    backgroundColor: Palette.bgSurface,
  },
  resultText: { flex: 1, gap: 2 },
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
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  goalChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Palette.gray100 },
  error: { color: Palette.error },
  doneWrap: { alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.xxl },
  celebrate: { width: 64, height: 64, borderRadius: Radius.full, backgroundColor: Palette.profitLight, alignItems: 'center', justifyContent: 'center' },
});
