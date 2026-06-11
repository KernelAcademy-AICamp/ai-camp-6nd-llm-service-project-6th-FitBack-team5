import { MaterialIcons } from '@expo/vector-icons';
import {
  TabList,
  TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MaxContentWidth } from '@/constants/theme';

// design.md §9 바텀 네비게이션 — 활성 #6675FF / 비활성 #D1D5DB, 배경 #FFFFFF, 상단 구분선 0.5px
const NAV = {
  active: '#6675FF',
  inactive: '#9CA3AF',
  surface: '#FFFFFF',
  line: 'rgba(0,0,0,0.07)',
} as const;

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="card-membership">회원권</TabButton>
          </TabTrigger>
          <TabTrigger name="diet" href="/diet" asChild>
            <TabButton icon="restaurant">식단</TabButton>
          </TabTrigger>
          <TabTrigger name="workout" href="/workout" asChild>
            <TabButton icon="fitness-center">홈트</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: IconName };

export function TabButton({ children, isFocused, icon, ...props }: TabButtonProps) {
  const color = isFocused ? NAV.active : NAV.inactive;
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <MaterialIcons name={icon} size={24} color={color} />
      <Text style={[styles.label, { color }]}>{children}</Text>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { height: '100%' },
  tabListContainer: {
    // 웹: 뷰포트 하단 고정 (absolute는 상위 높이에 따라 콘텐츠 끝에 붙는 문제가 있음)
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    backgroundColor: NAV.surface,
    borderTopWidth: 0.5,
    borderTopColor: NAV.line,
    alignItems: 'center',
  },
  innerContainer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  pressed: { opacity: 0.6 },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
