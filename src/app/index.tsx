import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  Elevation,
  MaxContentWidth,
  Radius,
  ScreenPaddingX,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

type MembershipStatus = 'active' | 'expired' | 'paused';

interface Membership {
  id: string;
  name: string;
  totalSessions: number | null;
  remainingSessions: number | null;
  expiresAt: string;
  status: MembershipStatus;
}

const dummyMemberships: Membership[] = [
  {
    id: '1',
    name: 'PT 30회',
    totalSessions: 30,
    remainingSessions: 23,
    expiresAt: '2026-12-31',
    status: 'active',
  },
  {
    id: '2',
    name: '요가 1개월권',
    totalSessions: null,
    remainingSessions: null,
    expiresAt: '2026-07-15',
    status: 'active',
  },
  {
    id: '3',
    name: '필라테스 10회',
    totalSessions: 10,
    remainingSessions: 0,
    expiresAt: '2026-05-30',
    status: 'expired',
  },
];

const statusLabels: Record<MembershipStatus, string> = {
  active: '사용중',
  expired: '만료',
  paused: '일시중지',
};

function MembershipCard({ item }: { item: Membership }) {
  const theme = useTheme();
  const isSession = item.totalSessions !== null;
  const badgeBg =
    item.status === 'active'
      ? theme.success
      : item.status === 'paused'
        ? theme.warning
        : theme.textSecondary;

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.lineDefault }, Elevation.level1]}>
      <View style={styles.cardHeader}>
        <ThemedText type="subtitle">{item.name}</ThemedText>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <ThemedText type="smallBold" style={styles.badgeText}>
            {statusLabels[item.status]}
          </ThemedText>
        </View>
      </View>
      {isSession && (
        <ThemedText type="default" themeColor="textBody">
          남은 {item.remainingSessions} / {item.totalSessions}회
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        만료일 · {item.expiresAt}
      </ThemedText>
    </ThemedView>
  );
}

function AuthFooter() {
  const theme = useTheme();
  const user = useCurrentUser();
  async function handleSignOut() {
    await supabase.auth.signOut();
  }
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.authFooter, { borderColor: theme.lineDefault }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.authEmail}>
        {user?.email ?? '(no session)'}
      </ThemedText>
      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [
          styles.authButton,
          { borderColor: theme.lineStrong, opacity: pressed ? 0.6 : 1 },
        ]}>
        <ThemedText type="smallBold">로그아웃</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export default function MembershipScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">내 회원권</ThemedText>
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}>
          {dummyMemberships.map((m) => (
            <MembershipCard key={m.id} item={m} />
          ))}
        </ScrollView>
        <AuthFooter />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: ScreenPaddingX,
    paddingTop: Spacing.lg,
    paddingBottom: BottomTabInset + Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  list: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.small,
  },
  badgeText: { color: '#FFFFFF' },
  authFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  authEmail: { flex: 1 },
  authButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
