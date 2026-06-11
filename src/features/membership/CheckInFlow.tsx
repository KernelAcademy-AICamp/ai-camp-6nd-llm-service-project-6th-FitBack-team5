import { Check, ChevronRight, CloudSun, MapPin, Navigation, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Icon } from '@/components/ui';
import { Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { ExerciseRecordForm } from '@/features/membership/ExerciseRecordForm';
import { getPosition } from '@/features/membership/location';
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

function InfoRow({ icon, children }: { icon: typeof CloudSun; children: string }) {
  return (
    <View style={styles.infoRow}>
      <Icon icon={icon} size={16} color={Palette.gray500} />
      <ThemedText type="caption" themeColor="textSecondary">
        {children}
      </ThemedText>
    </View>
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
      const p = await getPosition();
      if (cancelled) return;
      if (!p) {
        setGps({ phase: 'unavailable' });
        return;
      }
      if (center?.latitude != null && center?.longitude != null) {
        const km = distanceKm(p.lat, p.lng, center.latitude, center.longitude);
        setGps({ phase: km <= 1 ? 'near' : 'far', km });
      } else {
        setGps({ phase: 'unavailable' });
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
      const p = await getPosition();
      if (!cancelled && p) setOrigin({ lat: p.lat, lng: p.lng });
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
            <Button label="준비 완료" onPress={() => setStep('depart')} style={styles.action} />
          </>
        ) : null}

        {step === 'depart' ? (
          <>
            <StepLabel>STEP 2 · 출발</StepLabel>
            <ThemedText type="h2">지금 출발할까요?</ThemedText>
            <Card>
              {weather ? (
                <InfoRow icon={CloudSun}>{`${center?.name ?? '센터'} · ${weather.desc} ${weather.temp}°C`}</InfoRow>
              ) : null}
              {route ? (
                <InfoRow icon={Navigation}>{`센터까지 약 ${route.distanceKm.toFixed(1)}km · ${route.durationMin}분`}</InfoRow>
              ) : null}
              {!weather && !route ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  날씨·경로 정보를 불러오는 중이에요.
                </ThemedText>
              ) : null}
            </Card>
            <ThemedText type="body">한 걸음이면 도착이에요. 가볍게 다녀와요.</ThemedText>
            <Button label="출발하기" onPress={() => setStep('arrive')} style={styles.action} />
          </>
        ) : null}

        {step === 'arrive' ? (
          <>
            <StepLabel>STEP 3 · 도착</StepLabel>
            <ThemedText type="h2">센터에 거의 다 왔어요</ThemedText>
            {gps.phase === 'checking' ? <InfoRow icon={MapPin}>위치 확인 중…</InfoRow> : null}
            {gps.phase === 'near' ? (
              <View style={styles.infoRow}>
                <Icon icon={Check} size={16} color={Palette.profit} />
                <ThemedText type="captionBold" style={{ color: Palette.profit }}>
                  센터 도착 감지! ({Math.round((gps.km ?? 0) * 1000)}m 이내)
                </ThemedText>
              </View>
            ) : null}
            {gps.phase === 'far' ? (
              <InfoRow icon={MapPin}>
                {`아직 ${(gps.km ?? 0).toFixed(1)}km 떨어져 있어요. 도착하면 체크인하세요.`}
              </InfoRow>
            ) : null}
            {gps.phase === 'unavailable' ? (
              <InfoRow icon={MapPin}>위치 확인이 어려워요. 도착했다면 수동으로 체크인하세요.</InfoRow>
            ) : null}
            {error ? (
              <ThemedText type="caption" style={styles.error}>
                체크인 실패: {(error as Error).message}
              </ThemedText>
            ) : null}
            <Button
              label="도착 (체크인)"
              icon={MapPin}
              onPress={checkIn}
              loading={isPending}
              style={styles.action}
            />
          </>
        ) : null}

        {step === 'done' ? (
          <>
            <View style={styles.celebrate}>
              <Icon icon={Check} size={32} color={Palette.profit} />
            </View>
            <ThemedText type="h1">체크인 완료!</ThemedText>
            {selected ? (
              <ThemedText type="body">{selected.name} · 방문이 기록됐어요.</ThemedText>
            ) : null}
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
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
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
});
