import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

// Claude 비전에 보낼 형태 (base64 + MIME) + 미리보기용 원본 URI
export interface PreparedImage {
  uri: string;
  base64: string;
  mediaType: string;
}

// 긴 변 1024px·JPEG 60%로 축소 → 전송량·비전 비용 절감
async function prepare(originalUri: string): Promise<PreparedImage> {
  const ctx = ImageManipulator.manipulate(originalUri);
  ctx.resize({ width: 1024 });
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
  if (!out.base64) throw new Error('이미지 변환에 실패했어요');
  return { uri: originalUri, base64: out.base64, mediaType: 'image/jpeg' };
}

/** CameraView 등으로 직접 촬영한 uri → 리사이즈된 base64 반환. */
export async function prepareImage(uri: string): Promise<PreparedImage> {
  return prepare(uri);
}

/**
 * 앨범 선택 또는 카메라 촬영 → 리사이즈된 base64 반환.
 * 취소 시 null, 권한 거부 시 throw.
 */
export async function pickFoodImage(source: 'camera' | 'library'): Promise<PreparedImage | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('카메라 권한이 필요해요');
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets?.[0]) return null;
    return prepare(res.assets[0].uri);
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('사진 접근 권한이 필요해요');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets?.[0]) return null;
  return prepare(res.assets[0].uri);
}
