import * as Location from 'expo-location';
import { Platform } from 'react-native';

/**
 * 현재 위치 { lat, lng } 또는 실패 시 null.
 *
 * 웹: 브라우저 표준 API(navigator.geolocation)를 직접 사용한다. 데스크톱은 GPS가 없어
 *     WiFi 측위에 의존하는데, 고정밀(enableHighAccuracy) 요청은 macOS CoreLocation에서
 *     kCLErrorLocationUnknown으로 실패하기 쉽다. 1차 고정밀 실패 시 저정밀+캐시 허용으로
 *     재시도해 성공률을 높인다.
 * 네이티브: 권한을 먼저 요청한 뒤 expo-location으로 조회.
 */
export async function getPosition(): Promise<{ lat: number; lng: number } | null> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    const ask = (opts: PositionOptions) =>
      new Promise<{ lat: number; lng: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          opts,
        );
      });
    // 1차: 고정밀. 실패하면 2차: 저정밀 + 최근 10분 캐시 허용(데스크톱 WiFi 측위 완화).
    const first = await ask({ enableHighAccuracy: true, timeout: 8_000, maximumAge: 0 });
    if (first) return first;
    return ask({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 });
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({});
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
