import {
  Car,
  Check,
  ChevronRight,
  CloudSun,
  Footprints,
  MapPin,
  Navigation,
  Search,
  TrainFront,
  X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { ExerciseRecordForm } from '@/features/membership/ExerciseRecordForm';
import { KakaoMap } from '@/features/membership/KakaoMap';
import { getPosition } from '@/features/membership/location';
import { searchPlaces, type GeoResult } from '@/features/membership/useGeocode';
import { useCenter } from '@/features/membership/useCenter';
import { useCreateVisit } from '@/features/membership/useCreateVisit';
import { useRoute } from '@/features/membership/useRoute';
import { useTransit } from '@/features/membership/useTransit';
import { useWeather } from '@/features/membership/useWeather';
import type { Membership } from '@/features/membership/useMemberships';

type Step = 'select' | 'prepare' | 'depart' | 'going' | 'arrive' | 'done' | 'exercise' | 'logged';
type GpsPhase = 'idle' | 'checking' | 'near' | 'far' | 'unavailable';
type Mode = 'walk' | 'transit' | 'car';
type Pt = { lat: number; lng: number };

const MODE_META: Record<Mode, { icon: typeof Footprints; label: string }> = {
  walk: { icon: Footprints, label: '도보' },
  transit: { icon: TrainFront, label: '대중교통' },
  car: { icon: Car, label: '자동차' },
};

const SIM_MS = 30_000; // PC 시뮬레이션 총 이동 시간(데모용)
// 체크인 허용 반경. GPS 정확도(±10~50m)상 2m는 실측 불가하므로 현실적인 지오펜스로 100m 사용.
const CHECK_IN_RADIUS_KM = 0.1;

/** 두 좌표 간 거리(km). Haversine. */
function distanceKm(a: Pt, b: Pt): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function CheckItem({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.checkRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? <Icon icon={Check} size={16} color={Palette.white} /> : null}
      </View>
      <ThemedText type="body">{label}</ThemedText>
    </Pressable>
  );
}

function StepLabel({ children }: { children: string }) {
  return (
    <ThemedText type="label" themeColor="textSecondary">
      {children}
    </ThemedText>
  );
}

/** 이동수단 소요시간 행 (선택 가능). */
function ModeRow({
  mode,
  time,
  detail,
  loading,
  selected,
  onPress,
}: {
  mode: Mode;
  time: string;
  detail?: string;
  loading?: boolean;
  selected?: boolean;
  onPress?: () => void;
}) {
  const meta = MODE_META[mode];
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeRow, selected && styles.modeRowOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}>
      <View style={styles.timeLeft}>
        <View style={[styles.timeIcon, selected && styles.timeIconOn]}>
          <Icon icon={meta.icon} size={18} color={selected ? Palette.white : Palette.primary} />
        </View>
        <ThemedText type="captionBold">{meta.label}</ThemedText>
      </View>
      <View style={styles.timeRight}>
        {loading ? (
          <ActivityIndicator color={Palette.gray300} />
        ) : (
          <>
            <ThemedText type="captionBold">{time}</ThemedText>
            {detail ? (
              <ThemedText type="label" themeColor="textSecondary">
                {detail}
              </ThemedText>
            ) : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

export function CheckInFlow({ memberships, onClose }: { memberships: Membership[]; onClose: () => void }) {
  const single = memberships.length === 1;
  const [step, setStep] = useState<Step>(single ? 'prepare' : 'select');
  const [selectedId, setSelectedId] = useState<string | null>(single ? memberships[0].id : null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  const [clothes, setClothes] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [gps, setGps] = useState<{ phase: GpsPhase; km?: number }>({ phase: 'idle' });

  // 출발지: GPS 자동 → 실패 시 검색.
  const [origin, setOrigin] = useState<Pt | null>(null);
  const [originLabel, setOriginLabel] = useState('현재 위치');
  const [originQuery, setOriginQuery] = useState('');
  const [originResults, setOriginResults] = useState<GeoResult[]>([]);
  const [originSearching, setOriginSearching] = useState(false);
  const [gpsTried, setGpsTried] = useState(false);

  // 가는 중 실시간 상태.
  const [current, setCurrent] = useState<Pt | null>(null);
  const [remainKm, setRemainKm] = useState<number | null>(null);
  const [remainMin, setRemainMin] = useState<number | null>(null);
  const [etaText, setEtaText] = useState('');
  const [arrived, setArrived] = useState(false);
  const [usingSim, setUsingSim] = useState(false);

  const { mutate, isPending, error } = useCreateVisit();
  const { data: center } = useCenter(selectedId);
  const { data: weather } = useWeather(center?.latitude, center?.longitude);
  const { data: route, isLoading: routeLoading } = useRoute(
    origin?.lat,
    origin?.lng,
    center?.latitude,
    center?.longitude,
  );
  const { data: transit, isLoading: transitLoading } = useTransit(
    origin?.lat,
    origin?.lng,
    center?.latitude,
    center?.longitude,
  );

  const selected = memberships.find((m) => m.id === selectedId) ?? null;
  const hasCenterCoord = center?.latitude != null && center?.longitude != null;
  const dest: Pt | null = hasCenterCoord
    ? { lat: center!.latitude as number, lng: center!.longitude as number }
    : null;

  const modeMinutes = (m: Mode | null): number | null => {
    if (m === 'walk') return transit?.walk.minutes ?? null;
    if (m === 'transit') return transit?.transit?.minutes ?? null;
    if (m === 'car') return route?.durationMin ?? null;
    return null;
  };

  // 출발 단계 진입 시 현재 위치를 출발지로 시도.
  useEffect(() => {
    if (step !== 'depart' || gpsTried) return;
    setGpsTried(true);
    (async () => {
      const p = await getPosition();
      if (p) {
        setOrigin({ lat: p.lat, lng: p.lng });
        setOriginLabel('현재 위치');
      }
    })();
  }, [step, gpsTried]);

  // 가는 중: 실기기 GPS(watchPosition) → 실패 시 시뮬레이션. 실시간 잔여 거리/시간 갱신.
  useEffect(() => {
    if (step !== 'going' || !origin || !dest) return;
    const total = Math.max(0.001, distanceKm(origin, dest));
    const durMin = modeMinutes(mode) ?? Math.round((total / 30) * 60);
    // 예상 도착 시각(고정): 지금 + 소요시간.
    const eta = new Date(Date.now() + durMin * 60_000);
    setEtaText(`${pad2(eta.getHours())}:${pad2(eta.getMinutes())}`);
    setArrived(false);
    setCurrent(origin);
    setRemainKm(total);
    setRemainMin(durMin);

    let watchId: number | null = null;
    let simTimer: ReturnType<typeof setInterval> | null = null;
    let fixed = false;
    let simStarted = false;

    const update = (cur: Pt) => {
      const rem = distanceKm(cur, dest);
      setCurrent(cur);
      setRemainKm(rem);
      setRemainMin(Math.max(0, Math.round(durMin * (rem / total))));
      if (rem * 1000 < 80) setArrived(true);
    };

    const startSim = () => {
      if (simStarted) return;
      simStarted = true;
      setUsingSim(true);
      const t0 = Date.now();
      simTimer = setInterval(() => {
        const p = Math.min(1, (Date.now() - t0) / SIM_MS);
        update({
          lat: origin.lat + (dest.lat - origin.lat) * p,
          lng: origin.lng + (dest.lng - origin.lng) * p,
        });
        if (p >= 1 && simTimer) clearInterval(simTimer);
      }, 500);
    };

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          fixed = true;
          setUsingSim(false);
          update({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          if (!fixed) startSim();
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 },
      );
      fallbackTimer = setTimeout(() => {
        if (!fixed) startSim();
      }, 6000);
    } else {
      startSim();
    }

    return () => {
      if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
      if (simTimer) clearInterval(simTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // 도착 단계: 가는 중에서 도착했으면 바로 near, 아니면 위치 확인.
  useEffect(() => {
    if (step !== 'arrive') return;
    if (arrived) {
      setGps({ phase: 'near', km: 0 });
      return;
    }
    let cancelled = false;
    setGps({ phase: 'checking' });
    (async () => {
      const p = await getPosition();
      if (cancelled) return;
      if (!p || !dest) {
        setGps({ phase: 'unavailable' });
        return;
      }
      const km = distanceKm(p, dest);
      setGps({ phase: km <= CHECK_IN_RADIUS_KM ? 'near' : 'far', km });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function runOriginSearch() {
    const q = originQuery.trim();
    if (!q) return;
    setOriginSearching(true);
    try {
      setOriginResults(await searchPlaces(q));
    } catch {
      setOriginResults([]);
    } finally {
      setOriginSearching(false);
    }
  }

  function pickOrigin(r: GeoResult) {
    setOrigin({ lat: r.lat, lng: r.lng });
    setOriginLabel(r.name);
    setOriginResults([]);
    setOriginQuery('');
  }

  // asExercise=true: 위치 보정 경로 — 방문(출석) 기록 후 바로 운동 기록 화면으로(출석 근거).
  function checkIn(asExercise = false) {
    if (!selected) return;
    mutate(
      { membershipId: selected.id, centerName: center?.name ?? selected.name },
      {
        onSuccess: (data) => {
          setVisitId((data as { id: string }).id);
          setStep(asExercise ? 'exercise' : 'done');
        },
      },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="h2">센터 가기</ThemedText>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
          <Icon icon={X} size={24} color={Palette.gray500} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {step === 'select' ? (
          <>
            <ThemedText type="body">어느 회원권으로 가시나요?</ThemedText>
            {memberships.map((m) => (
              <Card
                key={m.id}
                onPress={() => {
                  setSelectedId(m.id);
                  setStep('prepare');
                }}>
                <View style={styles.optionRow}>
                  <ThemedText type="captionBold">{m.name}</ThemedText>
                  <Icon icon={ChevronRight} size={20} color={Palette.gray300} />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        {step === 'prepare' ? (
          <>
            <StepLabel>STEP 1 · 준비</StepLabel>
            <ThemedText type="h2">짐 챙기셨나요?</ThemedText>
            {selected ? (
              <ThemedText type="caption" themeColor="textSecondary">
                {selected.name}
              </ThemedText>
            ) : null}
            <CheckItem label="휴대폰" checked={phone} onToggle={() => setPhone((v) => !v)} />
            <CheckItem label="운동복" checked={clothes} onToggle={() => setClothes((v) => !v)} />
            <Button label="다음 (길 안내)" onPress={() => setStep('depart')} style={styles.action} />
          </>
        ) : null}

        {step === 'depart' ? (
          <>
            <StepLabel>STEP 2 · 출발</StepLabel>
            <ThemedText type="h2">{center?.name ?? selected?.name ?? '센터'}까지 가는 길</ThemedText>

            {dest ? (
              <KakaoMap lat={dest.lat} lng={dest.lng} label={center?.name ?? undefined} height={180} />
            ) : (
              <Card>
                <ThemedText type="caption" themeColor="textSecondary">
                  이 회원권에는 센터 위치가 없어요. 회원권 등록에서 센터를 검색해 설정하면 지도·경로가 표시됩니다.
                </ThemedText>
              </Card>
            )}

            {/* 출발지 */}
            <Card>
              <View style={styles.timeRow}>
                <View style={styles.timeLeft}>
                  <Icon icon={MapPin} size={16} color={Palette.gray500} />
                  <ThemedText type="caption" themeColor="textSecondary">
                    출발지
                  </ThemedText>
                </View>
                <ThemedText type="captionBold">{origin ? originLabel : '미설정'}</ThemedText>
              </View>
              <View style={styles.searchRow}>
                <TextInput
                  value={originQuery}
                  onChangeText={setOriginQuery}
                  onSubmitEditing={runOriginSearch}
                  returnKeyType="search"
                  placeholder={origin ? '출발지 변경 (주소·장소 검색)' : '출발지 검색 (예: 강남역)'}
                  placeholderTextColor={Palette.gray300}
                  style={styles.searchInput}
                />
                <Pressable
                  onPress={runOriginSearch}
                  disabled={originSearching}
                  style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}
                  accessibilityLabel="검색">
                  {originSearching ? (
                    <ActivityIndicator color={Palette.white} />
                  ) : (
                    <Icon icon={Search} size={18} color={Palette.white} />
                  )}
                </Pressable>
              </View>
              {originResults.map((r, i) => (
                <Pressable
                  key={`${r.lat}-${r.lng}-${i}`}
                  onPress={() => pickOrigin(r)}
                  style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
                  <Icon icon={MapPin} size={14} color={Palette.gray500} />
                  <View style={styles.resultText}>
                    <ThemedText type="captionBold">{r.name}</ThemedText>
                    {r.address ? (
                      <ThemedText type="label" themeColor="textSecondary">
                        {r.address}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </Card>

            {weather ? (
              <View style={styles.infoRow}>
                <Icon icon={CloudSun} size={16} color={Palette.gray500} />
                <ThemedText type="caption" themeColor="textSecondary">
                  {`${center?.name ?? '센터'} · ${weather.desc} ${weather.temp}°C`}
                </ThemedText>
              </View>
            ) : null}

            {/* 이동수단 선택 */}
            {dest && origin ? (
              <>
                <ThemedText type="caption" themeColor="textSecondary">
                  어떻게 가시나요?
                </ThemedText>
                <ModeRow
                  mode="walk"
                  selected={mode === 'walk'}
                  onPress={() => setMode('walk')}
                  loading={transitLoading}
                  time={transit ? `${transit.walk.minutes}분` : '-'}
                  detail={transit ? `${transit.walk.km}km` : undefined}
                />
                <ModeRow
                  mode="transit"
                  selected={mode === 'transit'}
                  onPress={() => setMode('transit')}
                  loading={transitLoading}
                  time={transit?.transit ? `${transit.transit.minutes}분` : '-'}
                  detail={
                    transit?.transit
                      ? `${transit.transit.type}${transit.transit.transfers > 0 ? ` · 환승 ${transit.transit.transfers}` : ''} · ${transit.transit.payment.toLocaleString('ko-KR')}원`
                      : transit
                        ? '경로 없음'
                        : undefined
                  }
                />
                <ModeRow
                  mode="car"
                  selected={mode === 'car'}
                  onPress={() => setMode('car')}
                  loading={routeLoading}
                  time={route ? `${route.durationMin}분` : '-'}
                  detail={route ? `${route.distanceKm.toFixed(1)}km` : undefined}
                />
              </>
            ) : dest && !origin ? (
              <ThemedText type="caption" themeColor="textSecondary">
                출발지를 설정하면 이동수단을 고를 수 있어요.
              </ThemedText>
            ) : null}

            <Button
              label={mode ? `${MODE_META[mode].label}로 출발하기` : '이동수단을 선택하세요'}
              onPress={() => setStep('going')}
              disabled={!mode || !origin || !dest}
              style={styles.action}
            />
          </>
        ) : null}

        {step === 'going' ? (
          <>
            <StepLabel>STEP 3 · 가는 중</StepLabel>
            <ThemedText type="h2">{center?.name ?? '센터'}까지 가는 중</ThemedText>

            {dest && origin ? (
              <KakaoMap
                lat={dest.lat}
                lng={dest.lng}
                label={center?.name ?? undefined}
                origin={origin}
                current={current}
                showLine
                height={220}
              />
            ) : null}

            <Card>
              <View style={styles.timeRow}>
                <View style={styles.timeLeft}>
                  <View style={styles.timeIcon}>
                    <Icon icon={mode ? MODE_META[mode].icon : Navigation} size={18} color={Palette.primary} />
                  </View>
                  <ThemedText type="captionBold">{mode ? MODE_META[mode].label : '이동'}</ThemedText>
                </View>
                <ThemedText type="captionBold">
                  남은 거리 {remainKm != null ? `${remainKm.toFixed(2)}km` : '-'}
                </ThemedText>
              </View>
              <View style={styles.divider} />
              <View style={styles.timeRow}>
                <ThemedText type="caption" themeColor="textSecondary">
                  도착 예정 {etaText}
                </ThemedText>
                <ThemedText type="captionBold" style={{ color: Palette.primary }}>
                  {remainMin != null ? (remainMin > 0 ? `${remainMin}분 남음` : '거의 도착') : '-'}
                </ThemedText>
              </View>
            </Card>

            {usingSim ? (
              <ThemedText type="label" themeColor="textSecondary">
                · 이 기기에서 GPS를 못 잡아 가상 이동으로 표시 중이에요 (실기기에선 실제 위치로 갱신).
              </ThemedText>
            ) : null}

            {arrived ? (
              <Button label="도착했어요" icon={Check} onPress={() => setStep('arrive')} style={styles.action} />
            ) : (
              <Pressable onPress={() => setStep('arrive')} style={styles.skip} hitSlop={8}>
                <ThemedText type="caption" themeColor="textSecondary">
                  여기를 눌러 도착해보세요 (수동)
                </ThemedText>
              </Pressable>
            )}
          </>
        ) : null}

        {step === 'arrive' ? (
          <>
            <StepLabel>STEP 4 · 도착</StepLabel>
            <ThemedText type="h2">센터에 도착했어요</ThemedText>
            {gps.phase === 'checking' ? (
              <View style={styles.infoRow}>
                <Icon icon={MapPin} size={16} color={Palette.gray500} />
                <ThemedText type="caption" themeColor="textSecondary">
                  위치 확인 중…
                </ThemedText>
              </View>
            ) : null}
            {gps.phase === 'near' ? (
              <View style={styles.infoRow}>
                <Icon icon={Check} size={16} color={Palette.profit} />
                <ThemedText type="captionBold" style={{ color: Palette.profit }}>
                  센터 도착 감지!{gps.km ? ` (${Math.round(gps.km * 1000)}m 이내)` : ''}
                </ThemedText>
              </View>
            ) : null}
            {gps.phase === 'far' ? (
              <View style={styles.infoRow}>
                <Icon icon={Navigation} size={16} color={Palette.gray500} />
                <ThemedText type="caption" themeColor="textSecondary">
                  {`아직 ${(gps.km ?? 0).toFixed(1)}km 떨어져 있어요. 도착하면 체크인하세요.`}
                </ThemedText>
              </View>
            ) : null}
            {gps.phase === 'unavailable' ? (
              <View style={styles.infoRow}>
                <Icon icon={MapPin} size={16} color={Palette.gray500} />
                <ThemedText type="caption" themeColor="textSecondary">
                  위치 확인이 어려워요. 도착했다면 수동으로 체크인하세요.
                </ThemedText>
              </View>
            ) : null}
            {error ? (
              <ThemedText type="caption" style={styles.error}>
                체크인 실패: {(error as Error).message}
              </ThemedText>
            ) : null}

            <Button
              label={gps.phase === 'near' ? '도착 (체크인)' : '체크인 가능 거리 밖'}
              icon={MapPin}
              onPress={() => checkIn(false)}
              loading={isPending}
              disabled={gps.phase !== 'near'}
              style={styles.action}
            />

            {/* 위치 보정: 거리 조건이 안 맞거나 GPS를 못 잡을 때, 운동 기록으로 출석 인정 */}
            {gps.phase !== 'near' ? (
              <>
                <ThemedText type="label" themeColor="textSecondary" style={styles.center}>
                  체크인은 센터 {Math.round(CHECK_IN_RADIUS_KM * 1000)}m 이내에서만 됩니다.
                  실제로 왔는데 위치가 안 잡히면 아래로 출석을 남기세요.
                </ThemedText>
                <Button
                  label="운동 기록으로 출석하기"
                  variant="secondary"
                  onPress={() => checkIn(true)}
                  loading={isPending}
                />
              </>
            ) : null}
          </>
        ) : null}

        {step === 'done' ? (
          <>
            <View style={styles.celebrate}>
              <Icon icon={Check} size={32} color={Palette.profit} />
            </View>
            <ThemedText type="h1">체크인 완료!</ThemedText>
            {selected ? <ThemedText type="body">{selected.name} · 방문이 기록됐어요.</ThemedText> : null}
            <Button label="운동 기록하기" onPress={() => setStep('exercise')} style={styles.action} />
            <Pressable onPress={onClose} style={styles.skip} hitSlop={8}>
              <ThemedText type="caption" themeColor="textSecondary">
                나중에 (닫기)
              </ThemedText>
            </Pressable>
          </>
        ) : null}

        {step === 'exercise' && visitId ? (
          <ExerciseRecordForm visitId={visitId} onDone={() => setStep('logged')} onSkip={onClose} />
        ) : null}

        {step === 'logged' ? (
          <>
            <View style={styles.celebrate}>
              <Icon icon={Check} size={32} color={Palette.profit} />
            </View>
            <ThemedText type="h1">운동 기록 완료!</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              이번 달 통계·위험도가 갱신됩니다.
            </ThemedText>
            <Button label="확인" onPress={onClose} style={styles.action} />
          </>
        ) : null}
      </ScrollView>
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
  body: { paddingHorizontal: ScreenPadding, paddingBottom: Spacing.xl, gap: Spacing.md },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  error: { color: Palette.error },
  action: { marginTop: Spacing.sm },
  pressed: { opacity: 0.7 },

  searchRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  searchInput: {
    flex: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    fontFamily: 'Pretendard',
    color: Palette.gray900,
    backgroundColor: Palette.gray100,
    minHeight: 44,
  },
  searchBtn: {
    width: 44,
    borderRadius: Radius.small,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: Palette.lineDefault,
  },
  resultText: { flex: 1, gap: 2 },

  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  timeIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.small,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeIconOn: { backgroundColor: Palette.primary },
  timeRight: { alignItems: 'flex-end', gap: 2 },
  divider: { height: 0.5, backgroundColor: Palette.lineDefault, marginVertical: Spacing.sm },

  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Palette.lineDefault,
    backgroundColor: Palette.bgSurface,
  },
  modeRowOn: { borderColor: Palette.primary, backgroundColor: Palette.primaryLight },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: Radius.small,
    borderWidth: 2,
    borderColor: Palette.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Palette.primary, borderColor: Palette.primary },
  celebrate: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Palette.profitLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: { alignItems: 'center', paddingVertical: Spacing.sm },
  center: { textAlign: 'center' },
});
