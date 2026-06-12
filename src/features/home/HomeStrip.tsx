import { router } from 'expo-router';
import { CreditCard, Dumbbell, UtensilsCrossed } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui';
import { formatNumber, sortByRisk, type RiskInfo } from '@/features/membership/dashboard';
import { useMeals } from '@/features/diet/useMeals';
import { useHomeActivity } from '@/features/home/useHomeActivity';
import type { Membership } from '@/features/membership/useMemberships';

function MiniCard({
  icon,
  label,
  headline,
  sub,
  subWarn,
  onPress,
}: {
  icon: typeof CreditCard;
  label: string;
  headline: string;
  sub?: string;
  subWarn?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
      <View style={styles.iconBox}>
        <Icon icon={icon} size={18} color={Palette.primary} />
      </View>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="captionBold" numberOfLines={1}>
        {headline}
      </ThemedText>
      {sub ? (
        <ThemedText type="label" style={subWarn ? styles.warn : styles.dim} numberOfLines={1}>
          {sub}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

/** 블록③ 3대 기능 스트립 — 회원권/운동/식단 바로가기 + 현재 상태 한 줄. */
export function HomeStrip({ withRisk }: { withRisk: { m: Membership; risk: RiskInfo; visits: number }[] }) {
  const { data: activity } = useHomeActivity();
  const { data: meals } = useMeals(); // 오늘

  // 회원권: 가장 급한(위험순) 1개 요약
  const top = sortByRisk(withRisk, (x) => x.risk)[0];
  const membershipHead = top
    ? top.risk.hasSessions
      ? `남은 ${formatNumber(top.risk.remainingSessions ?? 0)}회`
      : '자유이용'
    : '회원권 없음';
  const membershipSub = top
    ? top.risk.hasSessions
      ? `${formatNumber(top.risk.usedSessions)}/${formatNumber(top.risk.totalSessions ?? 0)}회 · ${formatNumber(top.risk.remainingDays)}일`
      : `${formatNumber(top.risk.remainingDays)}일 남음`
    : '등록해 보세요';

  // 운동: 이번 주 횟수
  const workoutHead = `이번 주 ${activity?.weekWorkouts ?? 0}회`;
  const workoutSub = activity?.lastRoutine ?? '운동을 기록해보세요';

  // 식단: 오늘 단백질·열량
  const todayProtein = (meals ?? []).reduce((s, m) => s + (m.protein ?? 0), 0);
  const todayKcal = (meals ?? []).reduce((s, m) => s + (m.kcal ?? 0), 0);
  const dietHead = (meals?.length ?? 0) > 0 ? `단백질 ${formatNumber(todayProtein)}g` : '기록 없음';
  const dietSub = (meals?.length ?? 0) > 0 ? `오늘 ${formatNumber(todayKcal)} kcal` : '오늘 식단을 남겨보세요';

  return (
    <View style={styles.strip}>
      <MiniCard
        icon={CreditCard}
        label="회원권"
        headline={membershipHead}
        sub={membershipSub}
        onPress={() => router.navigate('/membership')}
      />
      <MiniCard
        icon={Dumbbell}
        label="운동"
        headline={workoutHead}
        sub={workoutSub}
        onPress={() => router.navigate('/workout')}
      />
      <MiniCard
        icon={UtensilsCrossed}
        label="식단"
        headline={dietHead}
        sub={dietSub}
        onPress={() => router.navigate('/diet')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: Spacing.sm },
  mini: {
    flex: 1,
    gap: 4,
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    borderColor: Palette.lineDefault,
    backgroundColor: Palette.bgSurface,
  },
  pressed: { opacity: 0.85 },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.small,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dim: { opacity: 0.7 },
  warn: { color: Palette.warning },
});
