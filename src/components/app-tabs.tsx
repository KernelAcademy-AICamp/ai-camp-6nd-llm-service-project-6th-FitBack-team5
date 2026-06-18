import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Palette } from '@/constants/theme';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={Palette.bgSurface}
      indicatorColor={Palette.primaryLight}
      labelStyle={{ color: Palette.gray300, selected: { color: Palette.primary } }}>

      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>홈</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="membership">
        <NativeTabs.Trigger.Label>회원권</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="diet">
        <NativeTabs.Trigger.Label>식단</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="workout">
        <NativeTabs.Trigger.Label>운동</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

    </NativeTabs>
  );
}
