import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ThemedView } from '@/components/themed-view';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { useAuthBootstrap } from '@/features/auth/useAuthBootstrap';
import { useTheme } from '@/hooks/use-theme';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth';

function AppShell() {
  const colorScheme = useColorScheme();
  const theme = useTheme();
  useAuthBootstrap();
  const status = useAuthStore((s) => s.status);

  if (status === 'loading') {
    return (
      <ThemedView style={loadingStyles.container}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (status !== 'authenticated') {
    return <LoginScreen />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}

export default function TabLayout() {
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
  },
});
