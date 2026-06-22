import { useRouter } from 'expo-router';
import {
  TabList,
  TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import { Dumbbell, House, Utensils, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Elevation, MaxContentWidth, Palette, Radius } from '@/constants/theme';

const NAV = {
  active: Palette.primary,
  inactive: Palette.gray300,
} as const;

export default function AppTabs() {
  const router = useRouter();
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon={House}>홈</TabButton>
          </TabTrigger>
          <TabTrigger name="diet" href="/diet" asChild>
            <TabButton icon={Utensils}>식단</TabButton>
          </TabTrigger>
          {/* 운동 탭은 홈(/workout)을 기본 진입점으로 사용. 어디 있어도 항상 홈으로 리셋. */}
          <TabTrigger name="workout" href="/workout" asChild>
            <TabButton icon={Dumbbell} onPress={() => router.replace('/workout')}>
              홈트
            </TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: LucideIcon };

export function TabButton({ children, isFocused, icon: IconCmp, style: _ignored, ...props }: TabButtonProps) {
  const color = isFocused ? NAV.active : NAV.inactive;
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <IconCmp size={24} color={color} strokeWidth={1.5} />
      <Text style={[styles.label, { color }]}>{children}</Text>
    </Pressable>
  );
}

export function CustomTabList({ style: _ignored, ...props }: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { height: '100%' },
  tabListContainer: {
    position: 'fixed',
    bottom: 20,
    left: 20,
    right: 20,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 54,
    backgroundColor: 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(4px)',
    borderRadius: Radius.button,
    ...Elevation.level2,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    height: 54,
  },
  pressed: { opacity: 0.6 },
  label: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: -0.25,
  },
});
