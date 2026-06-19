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

type Step = 'info' | 'goal' | 'membership' | 'type' | 'detail' | 'done';

const STEP_ORDER: Step[] = ['info', 'goal', 'membership', 'type', 'detail'];

const GENDERS: { value: 'F' | 'M'; label: string }[] = [
  { value: 'F', label: '여자' },
  { value: 'M', label: '남자' },
];

const PERIODS: { value: MembershipPeriod; label: string }[] = [
  { value: 'month', label: '1개월' },
  { value: '3month', label: '3개월' },
  { value: '6month', label: '6개월' },
  { value: '12month', label: '12개월' },
];

// 회원권 형태 — 코치 톤(공포·위험 표현 없이, 소멸/정체로 안내)
const TYPES: { value: MembershipType; label: string; desc: string; ex: string }[] = [
  { value: 'period', label: '기간권', desc: '기간 내 무제한 이용 · 안 가면 진행이 멈춰요(정체)', ex: '예) 헬스 3개월권' },
  { value: 'session', label: '세션권', desc: '정해진 횟수만 이용 · 안 쓰면 사라져요(소멸)', ex: '예) PT 10회권' },
];

// 방문 빈도 단위(월/주/일)
const FREQ_UNITS: { value: 'month' | 'week' | 'day'; label: string }[] = [
  { value: 'month', label: '월' },
  { value: 'week', label: '주' },
  { value: 'day', label: '일' },
];
const FREQ_PRESETS = [2, 3, 4, 5];

const GOALS: { value: FitnessGoal; label: string; desc: string }[] = [
  { value: 'fat_loss', label: '체중 감량', desc: '건강하게 체지방을 줄여요' },
  { value: 'muscle_gain', label: '근력 향상', desc: '근력을 키우고 탄탄하게' },
  { value: 'health', label: '건강 관리', desc: '꾸준한 컨디션 관리' },
  { value: 'body_shape', label: '체형 개선', desc: '원하는 라인을 만들어요' },
  { value: 'habit', label: '습관 형성', desc: '운동을 루틴으로' },
];

const SESSION_PRESETS = [4, 8, 16];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function ageFromBirth(d: string): number {
  const b = new Date(`${d}T00:00:00`);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const mo = now.getMonth() - b.getMonth();
  if (mo < 0 || (mo === 0 && now.getDate() < b.getDate())) a -= 1;
  return a;
}
// 방문 빈도 → 주당 목표(weekly_goal)로 환산
function toWeekly(unit: 'month' | 'week' | 'day', count: number): number {
  if (count <= 0) return 0;
  if (unit === 'week') return count;
  if (unit === 'day') return count * 7;
  return Math.max(1, Math.round((count * 12) / 52)); // month
}

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>('info');

  // 내 정보(선택)
  const [birthDate, setBirthDate] = useState('2000-01-01');
  const [birthPickerOpen, setBirthPickerOpen] = useState(false);
  const [gender, setGender] = useState<'F' | 'M' | null>(null);
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
  const [freqUnit, setFreqUnit] = useState<'month' | 'week' | 'day'>('week'); // 기간권 방문 빈도 단위
  const [freqCount, setFreqCount] = useState(''); // 빈도 숫자
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
  const detailOk = type === 'session' ? Number(sessionCount) > 0 : type === 'period' ? Number(freqCount) > 0 : false;

  const inputStyle = (key: string) => [styles.input, focused === key && styles.inputFocused];
  const stepIndex = STEP_ORDER.indexOf(step);
  const curYear = new Date().getFullYear();

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

  // 공통 프로필/목표 페이로드
  function basePayload() {
    return {
      age: birthDate ? ageFromBirth(birthDate) : null,
      gender,
      height: height ? Number(height) : null,
      weight: weight ? Number(weight) : null,
      goal,
    };
  }

  // 회원권 등록 완료 → 저장
  function submitWithMembership() {
    if (!type) return;
    const maxVisits = type === 'session' ? Number(sessionCount) : null;
    const weeklyGoalNum = type === 'period' ? toWeekly(freqUnit, Number(freqCount)) : null;
    mutate(
      {
        ...basePayload(),
        membership: {
          name,
          cost: costNum,
          period,
          startDate,
          type,
          maxVisits,
          weeklyGoal: weeklyGoalNum,
          inputMethod: 'manual',
          centerName: centerName.trim() || null,
          centerLat: coord?.lat ?? null,
          centerLng: coord?.lng ?? null,
        },
      },
      { onSuccess: () => setStep('done') },
    );
  }

  // 다음에 등록하기 → 회원권 없이 저장
  function submitSkip() {
    mutate({ ...basePayload(), membership: null }, { onSuccess: () => setStep('done') });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {step !== 'done' ? (
          <View style={styles.progress}>
            {STEP_ORDER.map((s, i) => (
              <View key={s} style={[styles.dot, i <= stepIndex && styles.dotOn]} />
            ))}
          </View>
        ) : null}

        <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* ── 1) 내 정보 ── */}
          {step === 'info' ? (
            <>
              <ThemedText type="h1">반가워요!</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                맞춤 분석을 위해 기본 정보를 알려주세요. (나중에 바꿀 수 있어요)
              </ThemedText>

              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">생년월일</ThemedText>
                <Pressable onPress={() => setBirthPickerOpen(true)} style={styles.input}>
                  <ThemedText type="body">{birthDate}</ThemedText>
                </Pressable>
              </View>

              <View style={styles.field}>
                <ThemedText type="label" themeColor="textSecondary">성별</ThemedText>
                <View style={styles.segmentRow}>
                  {GENDERS.map((g) => {
                    const on = gender === g.value;
                    return (
                      <Pressable key={g.value} onPress={() => setGender(g.value)} style={[styles.segment, on && styles.segOn]}>
                        <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>
                          {g.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

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
                <ThemedText type="label" themeColor="textSecondary">체중 (kg)</ThemedText>
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
            </>
          ) : null}

          {/* ── 2) 가입 환영 + 운동 목표 ── */}
          {step === 'goal' ? (
            <>
              <ThemedText type="h1">가입을 환영해요!</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                어떤 목표로 운동하시나요? 맞춤 코칭에 쓸게요. (선택, 나중에 바꿀 수 있어요)
              </ThemedText>
              {GOALS.map((g) => {
                const on = goal === g.value;
                return (
                  <Card
                    key={g.value}
                    onPress={() => setGoal((v) => (v === g.value ? null : g.value))}
                    accentColor={on ? Palette.primary : undefined}
                    style={on ? styles.typeOn : undefined}>
                    <View style={styles.typeHead}>
                      <ThemedText type="h2">{g.label}</ThemedText>
                      {on ? <Icon icon={Check} size={20} color={Palette.primary} /> : null}
                    </View>
                    <ThemedText type="caption" themeColor="textSecondary">{g.desc}</ThemedText>
                  </Card>
                );
              })}
            </>
          ) : null}

          {/* ── 3) 회원권 등록 (선택) ── */}
          {step === 'membership' ? (
            <>
              <ThemedText type="h1">회원권을 등록해요</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                등록하면 회당 비용과 활용도를 분석해 드려요.
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

            </>
          ) : null}

          {/* ── 4) 회원권 형태 ── */}
          {step === 'type' ? (
            <>
              <ThemedText type="h1">어떤 형태의 회원권인가요?</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                형태에 맞춰 활용도와 되찾는 금액을 계산해 드려요. 하나만 골라주세요.
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
            </>
          ) : null}

          {/* ── 5) 형태별 상세 ── */}
          {step === 'detail' ? (
            <>
              {type === 'period' ? (
                <>
                  <ThemedText type="h1">운동 방문 빈도</ThemedText>
                  <ThemedText type="body" themeColor="textSecondary">얼마나 자주 가실 건가요? 회당 가치·되찾는 금액을 계산해요.</ThemedText>
                  <View style={styles.field}>
                    <ThemedText type="label" themeColor="textSecondary">단위</ThemedText>
                    <View style={styles.segmentRow}>
                      {FREQ_UNITS.map((u) => {
                        const on = freqUnit === u.value;
                        return (
                          <Pressable key={u.value} onPress={() => setFreqUnit(u.value)} style={[styles.segment, on && styles.segOn]}>
                            <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>{u.label}</ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.field}>
                    <ThemedText type="label" themeColor="textSecondary">횟수</ThemedText>
                    <View style={styles.segmentRow}>
                      {FREQ_PRESETS.map((n) => {
                        const on = freqCount === String(n);
                        return (
                          <Pressable key={n} onPress={() => setFreqCount(String(n))} style={[styles.segment, on && styles.segOn]}>
                            <ThemedText type={on ? 'captionBold' : 'caption'} style={on ? styles.activeText : undefined}>{n}회</ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                    <TextInput
                      value={freqCount}
                      onChangeText={(t) => setFreqCount(t.replace(/[^0-9]/g, ''))}
                      onFocus={() => setFocused('fc')}
                      onBlur={() => setFocused(null)}
                      keyboardType="numeric"
                      placeholder="직접 입력 (예: 3)"
                      placeholderTextColor={Palette.gray300}
                      style={inputStyle('fc')}
                    />
                  </View>
                  {Number(freqCount) > 0 ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      주 {toWeekly(freqUnit, Number(freqCount))}회로 환산해 분석해요.
                    </ThemedText>
                  ) : null}
                </>
              ) : null}

              {type === 'session' ? (
                <>
                  <ThemedText type="h1">계약한 횟수는?</ThemedText>
                  <ThemedText type="body" themeColor="textSecondary">회당 비용은 결제액 ÷ 계약 횟수로 계산돼요.</ThemedText>
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

              {error ? (
                <ThemedText type="caption" style={styles.error}>저장 실패: {(error as Error).message}</ThemedText>
              ) : null}
            </>
          ) : null}

          {/* ── 완료 ── */}
          {step === 'done' ? (
            <View style={styles.doneWrap}>
              <View style={styles.celebrate}>
                <Icon icon={Check} size={32} color={Palette.profit} />
              </View>
              <ThemedText type="h1">준비 완료!</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">이제 시작해볼까요? 회원권을 똑똑하게 챙겨드릴게요.</ThemedText>
            </View>
          ) : null}
        </ScrollView>

        {/* 하단 고정 CTA (모바일 UX — 주요 버튼은 하단) */}
        <View style={styles.footer}>
          {step === 'info' ? <Button label="다음" onPress={() => setStep('goal')} /> : null}
          {step === 'goal' ? <Button label="다음" onPress={() => setStep('membership')} /> : null}
          {step === 'membership' ? (
            <>
              <Button label="등록완료" onPress={() => setStep('type')} disabled={!membershipOk} />
              <Pressable onPress={submitSkip} disabled={isPending} style={styles.skipBtn} hitSlop={6}>
                <ThemedText type="captionBold" style={{ color: Palette.gray500 }}>
                  다음에 등록하기
                </ThemedText>
              </Pressable>
            </>
          ) : null}
          {step === 'type' ? <Button label="다음" onPress={() => setStep('detail')} disabled={!type} /> : null}
          {step === 'detail' ? (
            <Button label="완료" onPress={submitWithMembership} loading={isPending} disabled={!detailOk} />
          ) : null}
          {step === 'done' ? (
            <Button label="시작하기" onPress={() => queryClient.invalidateQueries({ queryKey: ['profile'] })} />
          ) : null}
        </View>
      </SafeAreaView>

      {/* 생년월일 휠 */}
      <DateWheelPicker
        visible={birthPickerOpen}
        value={birthDate}
        minYear={1940}
        maxYear={curYear}
        onConfirm={(d) => {
          setBirthDate(d);
          setBirthPickerOpen(false);
        }}
        onCancel={() => setBirthPickerOpen(false)}
      />
      {/* 시작일 휠 */}
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
  scroll: { flex: 1 },
  body: { paddingHorizontal: ScreenPadding, paddingVertical: Spacing.lg, gap: Spacing.md },
  field: { gap: Spacing.sm },
  footer: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: Palette.lineDefault,
    backgroundColor: Palette.bgBase,
  },
  skipBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
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
  error: { color: Palette.error },
  doneWrap: { alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.xxl },
  celebrate: { width: 64, height: 64, borderRadius: Radius.full, backgroundColor: Palette.profitLight, alignItems: 'center', justifyContent: 'center' },
});
