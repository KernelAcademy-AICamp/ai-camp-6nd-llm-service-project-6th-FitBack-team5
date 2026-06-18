import { LogOut, Ruler, Sparkles, Weight, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Icon } from '@/components/ui';
import { Palette, ScreenPadding, Spacing } from '@/constants/theme';
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

/** 마이 — 상단바 ☰에서 여는 드로어(모달). 명세 §2. */
export function MyDrawer({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser();
  const { data: profile } = useProfile();
  const name = profile?.display_name || '회원';

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <ThemedText type="h2">마이</ThemedText>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon icon={X} size={22} color={Palette.gray500} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* 프로필 */}
        <Card>
          <ThemedText type="h2">{name}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {user?.email ?? '(no session)'}
          </ThemedText>
        </Card>

        {/* 내 정보 */}
        <Card>
          <ThemedText type="captionBold">내 정보</ThemedText>
          <View style={styles.rows}>
            <InfoRow icon={Ruler} label="키" value={profile?.height != null ? `${profile.height} cm` : '-'} />
            <InfoRow icon={Weight} label="몸무게" value={profile?.weight != null ? `${profile.weight} kg` : '-'} />
          </View>
        </Card>

        {/* About */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    paddingVertical: Spacing.md,
  },
  body: { paddingHorizontal: ScreenPadding, paddingBottom: Spacing.xl, gap: Spacing.md },
  rows: { gap: Spacing.sm, marginTop: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  aboutHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 4 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.lineStrong,
    marginTop: Spacing.sm,
  },
  pressed: { opacity: 0.6 },
});
