import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ExerciseRecordForm } from '@/features/membership/ExerciseRecordForm';
import { useCenter } from '@/features/membership/useCenter';
import { useCreateVisit } from '@/features/membership/useCreateVisit';
import { useRoute } from '@/features/membership/useRoute';
import { useWeather } from '@/features/membership/useWeather';
import type { Membership } from '@/features/membership/useMemberships';

type Step = 'select' | 'prepare' | 'depart' | 'arrive' | 'done' | 'exercise' | 'logged';
type GpsPhase = 'idle' | 'checking' | 'near' | 'far' | 'unavailable';

/** 두 좌표 간 거리(km). Haversine. */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function CheckItem({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.checkRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? (
          <ThemedText type="smallBold" style={styles.checkMark}>
            ✓
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="default">{label}</ThemedText>
    </Pressable>
  );
}

function PrimaryBtn({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primary,
        (disabled || loading) && styles.primaryDim,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <ThemedText type="smallBold" style={styles.primaryLabel}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function CheckInFlow({
  memberships,
  onClose,
}: {
  memberships: Membership[];
  onClose: () => void;
}) {
  const single = memberships.length === 1;
  const [step, setStep] = useState<Step>(single ? 'prepare' : 'select');
  const [selectedId, setSelectedId] = useState<string | null>(single ? memberships[0].id : null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  const [clothes, setClothes] = useState(false);
  const [gps, setGps] = useState<{ phase: GpsPhase; km?: number }>({ phase: 'idle' });
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const { mutate, isPending, error } = useCreateVisit();
  const { data: center } = useCenter(selectedId);
  const { data: weather } = useWeather(center?.latitude, center?.longitude);
  const { data: route } = useRoute(origin?.lat, origin?.lng, center?.latitude, center?.longitude);

  const selected = memberships.find((m) => m.id === selectedId) ?? null;

  // 도착 단계 진입 시 위치를 확인해 센터와의 거리를 계산(키 불필요).
  useEffect(() => {
    if (step !== 'arrive') return;
    let cancelled = false;
    setGps({ phase: 'checking' });
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setGps({ phase: 'unavailable' });
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        if (center?.latitude != null && center?.longitude != null) {
          const km = distanceKm(
            pos.coords.latitude,
            pos.coords.longitude,
            center.latitude,
            center.longitude,
          );
          setGps({ phase: km <= 1 ? 'near' : 'far', km });
        } else {
          setGps({ phase: 'unavailable' });
        }
      } catch {
        if (!cancelled) setGps({ phase: 'unavailable' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, center]);

  // 출발 단계: 현재 위치를 origin으로 잡아 센터까지 경로를 조회.
  useEffect(() => {
    if (step !== 'depart') return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({});
        if (!cancelled) setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        /* 위치 실패 시 경로 생략 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  function checkIn() {
    if (!selected) return;
    mutate(
      { membershipId: selected.id, centerName: center?.name ?? selected.name },
      {
        onSuccess: (data) => {
          setVisitId((data as { id: string }).id);
          setStep('done');
        },
      },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle">센터 가기</ThemedText>
        <Pressable onPress={onClose} hitSlop={8}>
          <ThemedText type="default">닫기</ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {step === 'select' ? (
          <>
            <ThemedText type="default">어느 회원권으로 가시나요?</ThemedText>
            {memberships.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => {
                  setSelectedId(m.id);
                  setStep('prepare');
                }}
                style={({ pressed }) => [styles.optionBtn, pressed && styles.pressed]}>
                <ThemedText type="smallBold">{m.name}</ThemedText>
              </Pressable>
            ))}
          </>
        ) : null}

        {step === 'prepare' ? (
          <>
            <ThemedText type="small" style={styles.dim}>
              STEP 1 · 준비
            </ThemedText>
            <ThemedText type="subtitle">짐 챙기셨나요?</ThemedText>
            {selected ? (
              <ThemedText type="small" style={styles.dim}>
                {selected.name}
              </ThemedText>
            ) : null}
            <CheckItem label="휴대폰" checked={phone} onToggle={() => setPhone((v) => !v)} />
            <CheckItem label="운동복" checked={clothes} onToggle={() => setClothes((v) => !v)} />
            <PrimaryBtn label="준비 완료" onPress={() => setStep('depart')} />
          </>
        ) : null}

        {step === 'depart' ? (
          <>
            <ThemedText type="small" style={styles.dim}>
              STEP 2 · 출발
            </ThemedText>
            <ThemedText type="subtitle">지금 출발할까요?</ThemedText>
            {weather ? (
              <ThemedText type="small" style={styles.dim}>
                🌡️ {center?.name ?? '센터'} · {weather.desc} {weather.temp}°C
              </ThemedText>
            ) : null}
            {route ? (
              <ThemedText type="small" style={styles.dim}>
                🚗 센터까지 약 {route.distanceKm.toFixed(1)}km · {route.durationMin}분
              </ThemedText>
            ) : null}
            <ThemedText type="default">파이팅! 한 걸음이면 도착이에요 🙌</ThemedText>
            <PrimaryBtn label="출발하기" onPress={() => setStep('arrive')} />
          </>
        ) : null}

        {step === 'arrive' ? (
          <>
            <ThemedText type="small" style={styles.dim}>
              STEP 3 · 도착
            </ThemedText>
            <ThemedText type="subtitle">센터에 거의 다 왔어요!</ThemedText>
            {gps.phase === 'checking' ? (
              <ThemedText type="small" style={styles.dim}>
                📍 위치 확인 중…
              </ThemedText>
            ) : null}
            {gps.phase === 'near' ? (
              <ThemedText type="smallBold" style={styles.near}>
                ✅ 센터 도착 감지! ({Math.round((gps.km ?? 0) * 1000)}m 이내)
              </ThemedText>
            ) : null}
            {gps.phase === 'far' ? (
              <ThemedText type="small" style={styles.dim}>
                아직 {(gps.km ?? 0).toFixed(1)}km 떨어져 있어요. 도착하면 체크인하세요.
              </ThemedText>
            ) : null}
            {gps.phase === 'unavailable' ? (
              <ThemedText type="small" style={styles.dim}>
                위치 확인이 어려워요. 도착했다면 수동으로 체크인하세요.
              </ThemedText>
            ) : null}
            {error ? (
              <ThemedText type="small" style={styles.error}>
                체크인 실패: {(error as Error).message}
              </ThemedText>
            ) : null}
            <PrimaryBtn label="📍 도착 (체크인)" onPress={checkIn} loading={isPending} />
          </>
        ) : null}

        {step === 'done' ? (
          <>
            <ThemedText type="title">✅ 체크인 완료!</ThemedText>
            {selected ? (
              <ThemedText type="default">{selected.name} · 방문이 기록됐어요.</ThemedText>
            ) : null}
            <PrimaryBtn label="운동 기록하기" onPress={() => setStep('exercise')} />
            <Pressable onPress={onClose} style={styles.skip} hitSlop={8}>
              <ThemedText type="small" style={styles.dim}>
                나중에 (닫기)
              </ThemedText>
            </Pressable>
          </>
        ) : null}

        {step === 'exercise' && visitId ? (
          <ExerciseRecordForm
            visitId={visitId}
            onDone={() => setStep('logged')}
            onSkip={onClose}
          />
        ) : null}

        {step === 'logged' ? (
          <>
            <ThemedText type="title">💪 운동 기록 완료!</ThemedText>
            <ThemedText type="small" style={styles.dim}>
              이번 달 통계·위험도가 갱신됩니다.
            </ThemedText>
            <PrimaryBtn label="확인" onPress={onClose} />
          </>
        ) : null}
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
  body: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, gap: Spacing.three },
  dim: { opacity: 0.6 },
  near: { color: '#22c55e' },
  error: { color: '#d33' },
  optionBtn: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#22c55e' },
  checkMark: { color: '#fff' },
  primary: {
    marginTop: Spacing.two,
    backgroundColor: '#22c55e',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryDim: { backgroundColor: '#bbb' },
  pressed: { opacity: 0.85 },
  primaryLabel: { color: '#fff' },
  skip: { alignItems: 'center', paddingVertical: Spacing.two },
});
