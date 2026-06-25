import { Image, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { IconBell, IconCalendar, IconMenu } from '@/components/icons';
import { MaxContentWidth, Palette, Radius, ScreenPadding } from '@/constants/theme';

interface GnbBarProps {
  onMenu?: () => void;
  onCalendar?: () => void;
  onAlarm?: () => void;
  hasAlarm?: boolean;
  showCalendar?: boolean;
  style?: ViewStyle;
}

export function GnbBar({
  onMenu,
  onCalendar,
  onAlarm,
  hasAlarm = false,
  showCalendar = true,
  style,
}: GnbBarProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={onMenu}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="메뉴 열기">
            <IconMenu size={22} color={Palette.gray900} />
          </Pressable>
          <Image
            source={require('../../assets/images/Logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.headerActions}>
          {showCalendar && (
            <Pressable
              onPress={onCalendar}
              style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="달력 보기">
              <IconCalendar size={22} color={Palette.gray300} />
            </Pressable>
          )}
          <Pressable
            onPress={onAlarm}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="알림">
            <View>
              <IconBell size={22} color={Palette.gray300} />
              {hasAlarm && <View style={styles.alarmDot} />}
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: ScreenPadding,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerActions: { flexDirection: 'row', gap: 20 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  logo: { width: 110, height: 19 },
  alarmDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.error,
  },
});
