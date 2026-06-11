import { MapPin } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui';
import { Palette, Radius } from '@/constants/theme';

// 네이티브 폴백 — 카카오맵 인터랙티브는 웹(KakaoMap.web.tsx)에서 동작.
// 네이티브 지도는 추후 WebView/react-native-kakao로 추가 예정.
export function KakaoMap({
  label,
  height = 200,
}: {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
  origin?: { lat: number; lng: number } | null;
  current?: { lat: number; lng: number } | null;
  showLine?: boolean;
}) {
  return (
    <View style={[styles.fallback, { height }]}>
      <Icon icon={MapPin} size={24} color={Palette.gray500} />
      <ThemedText type="caption" themeColor="textSecondary">
        {label ?? '센터 위치'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    width: '100%',
    borderRadius: Radius.card,
    backgroundColor: Palette.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
