import { LogOut, Ruler, Sparkles, Weight } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Icon } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Palette, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { useProfile } from '@/features/auth/useProfile';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/auth';

function InfoRow({ icon, label, value }: { icon: typeof Ruler; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Icon icon={icon} size={16} color={Palette.gray500} />
        <ThemedText type="caption" themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
      <ThemedText type="captionBold">{value}</ThemedText>
    </View>
  );
}

export default function MyScreen() {
  const user = useCurrentUser();
  const { data: profile } = useProfile();
  const name = profile?.display_name || '회원';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <ThemedText type="h1">마이</ThemedText>

          {/* 프로필 */}
          <Card style={styles.profileCard}>
            <View style={styles.avatar}>
              <ThemedText type="h2" style={{ color: Palette.primary }}>
                {name.charAt(0)}
              </ThemedText>
            </View>
            <View>
              <ThemedText type="h2">{name}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {user?.email ?? '(no session)'}
              </ThemedText>
            </View>
          </Card>

          {/* 신체 정보 */}
          <Card>
            <ThemedText type="captionBold">내 정보</ThemedText>
            <View style={styles.rows}>
              <InfoRow icon={Ruler} label="키" value={profile?.height != null ? `${profile.height} cm` : '-'} />
              <InfoRow
                icon={Weight}
                label="몸무게"
                value={profile?.weight != null ? `${profile.weight} kg` : '-'}
              />
            </View>
          </Card>

          {/* About — FitBack 철학 (모달 배치 기획안 스크린4) */}
          <Card accentColor={Palette.primary}>
            <View style={styles.aboutHead}>
              <Icon icon={Sparkles} size={16} color={Palette.primary} />
              <ThemedText type="captionBold" style={{ color: Palette.primary }}>
                FitBack은 이렇게 일해요
              </ThemedText>
            </View>
            <ThemedText type="caption" themeColor="textSecondary">
              평가하지 않아요. 데이터를 보여주고, 다음 행동을 제안해요. 그리고 가끔은 회원권 걱정을 대신 해드려요.
            </ThemedText>
          </Card>

          {/* 로그아웃 */}
          <Pressable
            onPress={() => supabase.auth.signOut()}
            style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
            accessibilityRole="button">
            <Icon icon={LogOut} size={16} color={Palette.gray500} />
            <ThemedText type="caption" themeColor="textSecondary">
              로그아웃
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgBase },
  safeArea: {
    flex: 1,
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.md,
    paddingBottom: BottomTabInset + Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  body: { gap: Spacing.md, paddingBottom: Spacing.lg },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: { gap: Spacing.sm, marginTop: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  aboutHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Palette.lineStrong,
    marginTop: Spacing.sm,
  },
  pressed: { opacity: 0.6 },
});
