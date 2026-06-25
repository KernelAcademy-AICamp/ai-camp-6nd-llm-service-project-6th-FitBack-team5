import React from 'react';
import { usePathname, useRouter } from 'expo-router';
import {
  TabList,
  TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { IconFit, IconFood, IconHome } from '@/components/icons';
import { MaxContentWidth, Palette, Radius } from '@/constants/theme';

// Figma 491:1533 — 탭바 위쪽 섀도우 (y: -2)
const tabBarShadow = { boxShadow: '0px -2px 12px 0px rgba(34,44,67,0.08)' } as ViewStyle;

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
            <TabButton icon={IconHome}>홈</TabButton>
          </TabTrigger>
          <TabTrigger name="diet" href="/diet" asChild>
            <TabButton icon={IconFood}>식단</TabButton>
          </TabTrigger>
          {/* 운동 탭은 홈(/workout)을 기본 진입점으로 사용. 어디 있어도 항상 홈으로 리셋. */}
          <TabTrigger name="workout" href="/workout" asChild>
            <TabButton icon={IconFit} onPress={() => router.replace('/workout')}>
              홈트
            </TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type FigmaIcon = (props: { color: string; size?: number }) => React.ReactElement;
type TabButtonProps = TabTriggerSlotProps & { icon: FigmaIcon };

export function TabButton({ children, isFocused, icon: IconCmp, style: _ignored, ...props }: TabButtonProps) {
  const color = isFocused ? NAV.active : NAV.inactive;
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <IconCmp size={24} color={color} />
      <Text style={[styles.label, { color }]}>{children}</Text>
    </Pressable>
  );
}

const TAB_ROUTES = new Set(['/', '/diet', '/workout']);

export function CustomTabList({ style: _ignored, ...props }: TabListProps) {
  const pathname = usePathname();
  if (!TAB_ROUTES.has(pathname)) return null;
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { height: '100%' },
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 54,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    marginHorizontal: 'auto' as unknown as number,
    height: 54,
    backgroundColor: Palette.bgSurface,
    borderTopLeftRadius: Radius.button,
    borderTopRightRadius: Radius.button,
    ...tabBarShadow,
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
