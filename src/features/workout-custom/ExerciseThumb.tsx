/**
 * 작은 종목 썸네일 — 루틴 행, 오운완 행, 공유 카드 등에서 재사용.
 * image_path 가 있으면 Storage public URL 을 그려주고, 없거나 실패 시 'No Image'.
 */

import { useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, Radius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const BUCKET = 'workout-custom-exercise';

export function ExerciseThumb({
  imagePath,
  size = 48,
  style,
}: {
  imagePath: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const url = useMemo(() => {
    if (!imagePath) return null;
    return supabase.storage.from(BUCKET).getPublicUrl(imagePath).data.publicUrl;
  }, [imagePath]);

  const dim = { width: size, height: size, borderRadius: Radius.button };

  if (!url || failed) {
    return (
      <View style={[dim, styles.placeholder, style]}>
        <ThemedText type="label" themeColor="textSecondary" style={{ fontSize: 9 }}>
          No Image
        </ThemedText>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      style={[dim, style as StyleProp<ImageStyle>]}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: Palette.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
