import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { Palette } from '@/constants/theme';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { useAuthBootstrap } from '@/features/auth/useAuthBootstrap';
import { useProfile } from '@/features/auth/useProfile';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : (process.env.EXPO_PUBLIC_SENTRY_ENV ?? 'preview'),
  enabled: !__DEV__ && !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

// 라이트 전용 (디자인 시스템: 웜 오프화이트 배경)
const FitBackTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: Palette.bgBase, primary: Palette.primary },
};

function AppShell() {
  useAuthBootstrap();
  const status = useAuthStore((s) => s.status);
  const { data: profile, isLoading: profileLoading, isError: profileError } = useProfile();

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

  // 프로필 로딩 중 — 깜빡임 방지 (에러 시엔 스피너 해제하고 탭 진입)
  if (profileLoading && !profileError) {
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

const SPLASH_HOLD = 1200;
const SPLASH_FADE = 300;

function SplashScreen({ opacity }: { opacity: Animated.Value }) {
  return (
    <Animated.View style={[splashStyles.overlay, { opacity }]}>
      <LinearGradient
        colors={[Palette.primary, Palette.primaryHover]}
        style={splashStyles.container}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <Image
          source={require('@/assets/images/Logo.png')}
          style={splashStyles.logo}
          resizeMode="contain"
          tintColor="#FFFFFF"
        />
      </LinearGradient>
    </Animated.View>
  );
}

export default Sentry.wrap(function TabLayout() {
  const [fontsLoaded] = useFonts({
    Pretendard: require('@/assets/fonts/Pretendard-Regular.otf'),
    PretendardMedium: require('@/assets/fonts/Pretendard-Medium.otf'),
    PretendardSemiBold: require('@/assets/fonts/Pretendard-SemiBold.otf'),
    PretendardBold: require('@/assets/fonts/Pretendard-Bold.otf'),
  });
  const [splashDone, setSplashDone] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const hold = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: SPLASH_FADE,
        useNativeDriver: true,
      }).start(() => setSplashDone(true));
    }, SPLASH_HOLD);
    return () => clearTimeout(hold);
  }, [opacity]);

  if (!splashDone) return <SplashScreen opacity={opacity} />;

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
});

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.bgBase,
  },
});

const splashStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 159,
    height: 32,
  },
});