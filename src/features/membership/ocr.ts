// 네이티브 OCR 엔진 자리 (iOS/Android). dev client 빌드 후 ML Kit 온디바이스 연결:
//   import TextRecognition from '@react-native-ml-kit/text-recognition';
//   const result = await TextRecognition.recognize(uri);
//   return result.text;
// ML Kit은 온디바이스라 서버 비용 0 · API 키 불필요. (Expo Go 불가 → dev client 필요)
export async function recognizeText(_uri: string): Promise<string> {
  throw new Error('네이티브 OCR은 dev client 빌드 + ML Kit 연결 후 동작합니다. 지금은 직접 입력해 주세요.');
}
