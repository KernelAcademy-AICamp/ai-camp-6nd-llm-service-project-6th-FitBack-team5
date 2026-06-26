/**
 * 4/4 운동 공유 — 요약 카드 + 이미지 저장(준비중) + OS 공유 시트.
 */

import { useRouter } from 'expo-router';
import { ChevronLeft, Download, Share2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Icon } from '@/components/ui';
import {
  BottomTabInset,
  Elevation,
  MaxContentWidth,
  Palette,
  Radius,
  ScreenPadding,
  Spacing,
  Typography,
} from '@/constants/theme';
import { ExerciseThumb } from '@/features/workout-custom/ExerciseThumb';
import { saveCardImage, shareCardImage } from '@/features/workout-custom/captureShare';
import { useCustomWorkoutDraft } from '@/stores/workout-custom';

function formatTodayKR() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${y}.${m}.${day} (${weekdays[d.getDay()]})`;
}

export default function ShareScreen() {
  const router = useRouter();
  const items = useCustomWorkoutDraft((s) => s.items) ?? [];
  const reset = useCustomWorkoutDraft((s) => s.reset);

  const total = items.reduce((s, it) => s + it.duration_min, 0);

  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleShare() {
    const lines = items.map((it) => `• ${it.name} ${it.duration_min}분`).join('\n');
    const text = `오늘도 해냈어요! ${total}분 운동 완료 💪\n\n${lines}\n\n#오운완 #건강한습관 #FitBack`;
    try {
      setSharing(true);
      await shareCardImage(cardRef, text);
    } catch (e) {
      Alert.alert('공유 실패', e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.');
    } finally {
      setSharing(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      await saveCardImage(cardRef);
    } catch (e) {
      Alert.alert('저장 실패', e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    reset();
    router.replace('/workout');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon icon={ChevronLeft} size={24} color={Palette.gray900} />
          </Pressable>
          <ThemedText type="subtitle">운동 공유</ThemedText>
          <ThemedText type="captionBold" style={{ color: Palette.gray500 }}>
            4 / 4
          </ThemedText>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <ThemedText type="h2">오늘의 운동을 공유해보세요!</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.xs }}>
            멋진 기록을 함께 나눠요.
          </ThemedText>

          {/* 공유 카드 — cardRef 영역만 캡처해 이미지화 */}
          <View ref={cardRef} collapsable={false} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.badge}>
                <ThemedText type="label" style={{ color: Palette.white }}>
                  오운완!
                </ThemedText>
              </View>
              <ThemedText type="caption" themeColor="textSecondary">
                {formatTodayKR()}
              </ThemedText>
            </View>

            {/* 좌: 문구 (정상 흐름) · 우: 캐릭터 (absolute) — 캐릭터가 행 높이를 차지하지 않게 띄워서
                바로 아래 루틴 박스가 캐릭터 발 영역까지 올라온다. */}
            <View style={styles.heroSection}>
              <View style={styles.heroText}>
                <ThemedText type="h2" numberOfLines={1} adjustsFontSizeToFit>
                  오늘도 해냈어요!
                </ThemedText>
                <ThemedText
                  type="display"
                  style={{ color: Palette.primary, marginTop: Spacing.xs }}
                  numberOfLines={1}>
                  {total}분
                </ThemedText>
                <ThemedText type="h2" numberOfLines={1}>
                  운동 완료
                </ThemedText>
              </View>
              <Image
                source={require('../../../../assets/images/character.png')}
                style={styles.illust}
                contentFit="contain"
                accessibilityLabel="오운완 캐릭터"
              />
            </View>

            <View style={styles.routineBox}>
              <ThemedText type="captionBold" style={{ marginBottom: Spacing.sm }}>
                나의 커스텀 루틴
              </ThemedText>
              {items.map((it) => (
                <View key={it.catalog_id} style={styles.routineRow}>
                  <ExerciseThumb imagePath={it.image_path} size={28} />
                  <ThemedText type="caption" style={{ flex: 1 }}>
                    {it.name}
                  </ThemedText>
                  <ThemedText style={styles.routineMeta}>
                    {it.sets}세트 × {it.reps}{it.unit}
                  </ThemedText>
                  <ThemedText type="captionBold" style={{ color: Palette.primary }}>
                    {it.duration_min}분
                  </ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.cardFooter}>
              <ThemedText type="captionBold" style={{ color: Palette.primary }}>
                FitBack
              </ThemedText>
              <ThemedText type="label" themeColor="textSecondary">
                #오운완  #건강한습관
              </ThemedText>
            </View>
          </View>

          {/* CTA — 스크롤 끝 인라인 */}
          <View style={styles.ctaWrap}>
            <Button
              label="이미지 저장"
              variant="outline"
              icon={Download}
              loading={saving}
              onPress={handleSave}
              style={{ marginBottom: Spacing.sm }}
            />
            <Button
              label="공유하기"
              icon={Share2}
              loading={sharing}
              onPress={handleShare}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgBase },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenPadding,
    height: 52,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: ScreenPadding,
    // 네이티브: NativeTabs 자체 inset 처리 → BottomTabInset 불필요. 웹: fixed 탭바 보정.
    paddingBottom: Spacing.xxl + (Platform.OS === 'web' ? BottomTabInset : 0),
  },

  card: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    ...Elevation.level1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },

  heroSection: {
    position: 'relative',
    marginTop: Spacing.md,
    minHeight: 150,
    paddingRight: 130,
    // 캐릭터(absolute, zIndex)가 아래 routineBox 보다 위 레이어로 그려지도록.
    zIndex: 2,
    // 안드로이드: zIndex 대신 elevation 으로 위 레이어 보장.
    elevation: 2,
  },
  heroText: {
    // 정상 흐름. 캐릭터는 absolute 라 row 높이를 차지하지 않음.
  },
  illust: {
    position: 'absolute',
    right: 0,
    // 카드 아래로 살짝 내려와 routineBox 상단을 발이 덮음.
    bottom: -24,
    width: 150,
    height: 170,
    backgroundColor: 'transparent',
    zIndex: 3,
  },

  routineBox: {
    backgroundColor: Palette.bgSurface,
    borderRadius: Radius.card,
    padding: Spacing.md,
    // 카드 좌우 padding(Spacing.lg=24) 을 음수 마진으로 일부 상쇄해 박스를 넓게.
    marginHorizontal: -Spacing.md,
    // hero 영역을 위로 끌어올려 캐릭터 PNG 의 하단 투명 여백을 박스가 덮게 한다.
    // 캐릭터는 zIndex 로 위 레이어라 발은 박스를 가로지르며 보임.
    marginTop: -32,
    zIndex: 1,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  routineThumb: {
    width: 28,
    height: 28,
    borderRadius: Radius.small,
    backgroundColor: Palette.bgMuted,
  },
  routineMeta: {
    // #오운완 태그(gray500)보다 더 연한 회색. duration 왼쪽에 오른쪽 정렬로 붙음.
    ...Typography.label,
    color: Palette.gray400,
    textAlign: 'right',
    marginRight: Spacing.sm,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },

  ctaWrap: {
    marginTop: Spacing.lg,
  },
});
