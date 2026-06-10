import * as Location from 'expo-location';
import { Platform } from 'react-native';

/**
 * 현재 위치. 웹에선 권한 확인(requestForegroundPermissionsAsync)이 팝업을 안 띄우는
 * 경우가 많아, 권한 확인을 건너뛰고 getCurrentPositionAsync를 바로 호출 → 브라우저가
 * 권한 팝업을 띄운다. 네이티브는 권한 확인이 필요하므로 확인 후 요청. 실패 시 null.
 */
export async function getPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    if (Platform.OS !== 'web') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
    }
    const pos = await Location.getCurrentPositionAsync({});
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
