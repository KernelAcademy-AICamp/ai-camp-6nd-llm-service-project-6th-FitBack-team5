import { useRouter } from 'expo-router';
import {
  TabList,
  TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconFit, IconFood, IconHome } from '@/components/icons';
import { MaxContentWidth, Palette, Radius } from '@/constants/theme';

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
          <TabTrigger name="workout" href="/workout" asChild>
            <TabButton icon={IconFit} onPress={() => router.replace('/workout')}>
              운동
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
  const { bottom } = useSafeAreaInsets();
  return (
    <View {...props} style={[styles.tabListContainer, { paddingBottom: bottom, backgroundColor: Palette.bgSurface }]}>
      <View style={styles.innerContainer}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
  tabListContainer: {
    // height은 innerContainer(54) + paddingBottom(safe area) 합산으로 동적 결정
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: Palette.bgSurface,
    borderTopLeftRadius: Radius.button,
    borderTopRightRadius: Radius.button,
    shadowColor: '#222C43',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
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
