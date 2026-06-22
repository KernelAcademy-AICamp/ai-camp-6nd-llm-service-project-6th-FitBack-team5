import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { Palette } from '@/constants/theme';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { useAuthBootstrap } from '@/features/auth/useAuthBootstrap';
import { useProfile } from '@/features/auth/useProfile';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth';

// 라이트 전용 (디자인 시스템: 웜 오프화이트 배경)
const FitBackTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: Palette.bgBase, primary: Palette.primary },
};

function AppShell() {
  useAuthBootstrap();
  const status = useAuthStore((s) => s.status);
  const { data: profile, isLoading: profileLoading } = useProfile();

  if (status === 'loading') {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator color={Palette.primary} />
      </View>
    );
  }

  if (status !== 'authenticated') {
    return <LoginScreen />;
  }

  // 프로필 로딩 중 — 깜빡임 방지
  if (profileLoading) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator color={Palette.primary} />
      </View>
    );
  }

  // 최초 로그인 온보딩 (미완료 시) — 완료하면 profile 무효화 → 탭 진입
  if (profile && !profile.onboarded) {
    return <OnboardingFlow />;
  }

  return (
    <ThemeProvider value={FitBackTheme}>
      <AnimatedSplashOverlay />
      <LinearGradient
        colors={[`${Palette.primary}14`, Palette.bgBase]}
        style={{ flex: 1 }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <AppTabs />
      </LinearGradient>
    </ThemeProvider>
  );
}

export default function TabLayout() {
  const [fontsLoaded] = useFonts({
    Pretendard: require('@/assets/fonts/Pretendard-Regular.otf'),
    PretendardMedium: require('@/assets/fonts/Pretendard-Medium.otf'),
    PretendardSemiBold: require('@/assets/fonts/Pretendard-SemiBold.otf'),
    PretendardBold: require('@/assets/fonts/Pretendard-Bold.otf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator color={Palette.primary} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.bgBase,
  },
});