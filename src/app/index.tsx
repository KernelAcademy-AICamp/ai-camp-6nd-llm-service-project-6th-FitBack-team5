import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
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

function statusBadgeColor(status: MembershipStatus) {
  if (status === 'active') return '#22c55e';
  if (status === 'paused') return '#f59e0b';
  return '#9ca3af';
}

function MembershipCard({ item }: { item: Membership }) {
  const isSession = item.totalSessions !== null;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="subtitle">{item.name}</ThemedText>
        <View style={[styles.badge, { backgroundColor: statusBadgeColor(item.status) }]}>
          <ThemedText type="smallBold" style={styles.badgeText}>
            {statusLabels[item.status]}
          </ThemedText>
        </View>
      </View>
      {isSession && (
        <ThemedText type="default">
          남은 {item.remainingSessions} / {item.totalSessions}회
        </ThemedText>
      )}
      <ThemedText type="small">만료일 · {item.expiresAt}</ThemedText>
    </ThemedView>
  );
}

function AuthFooter() {
  const user = useCurrentUser();
  async function handleSignOut() {
    await supabase.auth.signOut();
  }
  return (
    <ThemedView type="backgroundElement" style={styles.authFooter}>
      <ThemedText type="small" style={styles.authEmail}>
        {user?.email ?? '(no session)'}
      </ThemedText>
      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [styles.authButton, pressed && styles.authButtonPressed]}>
        <ThemedText type="small">로그아웃</ThemedText>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.two,
  },
  badgeText: { color: '#fff' },
  authFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    gap: Spacing.three,
  },
  authEmail: { flex: 1 },
  authButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
  },
  authButtonPressed: { opacity: 0.6 },
});
