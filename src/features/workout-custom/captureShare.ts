/**
 * 공유 카드 캡처 + 공유/저장 — iOS/Android 와 웹을 분기.
 *
 * 네이티브 모듈(react-native-view-shot, expo-sharing, expo-media-library)은
 * 웹에서 import 만 해도 'Class extends undefined' 가 터지므로 동적 import 로
 * 플랫폼 분기 안에서만 로드한다. 웹에서는 html-to-image 만 동적 import.
 */

import type { RefObject } from 'react';
import { Alert, Platform, type View } from 'react-native';

const FILENAME = 'fitback-workout.png';
// 갤러리 폴더(앨범) — Android 는 DCIM/Pictures 아래 동명 폴더 생성, iOS 는 Photos 앨범으로 묶임.
const ALBUM_NAME = 'FitBack';

type CardRef = RefObject<View | null>;

function timestampedFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `fitback-오운완-${date}-${time}.png`;
}

async function captureToUri(ref: CardRef, fileName?: string): Promise<string> {
  if (!ref.current) throw new Error('카드 영역을 찾지 못했어요.');
  const { captureRef } = await import('react-native-view-shot');
  return captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', fileName });
}

async function captureToDataUrl(ref: CardRef): Promise<string> {
  if (!ref.current) throw new Error('카드 영역을 찾지 못했어요.');
  const htmlToImage = await import('html-to-image');
  // RN Web 에서 View.ref 는 HTMLDivElement 와 호환.
  const node = ref.current as unknown as HTMLElement;
  return htmlToImage.toPng(node, { cacheBust: true, pixelRatio: 2 });
}

/** 카드를 이미지로 만들어 공유. */
export async function shareCardImage(ref: CardRef, fallbackText: string): Promise<void> {
  if (Platform.OS === 'web') {
    const dataUrl = await captureToDataUrl(ref);
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], FILENAME, { type: 'image/png' });
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    if (nav && 'canShare' in nav && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text: fallbackText });
      return;
    }
    downloadDataUrlOnWeb(dataUrl);
    Alert.alert('이미지 다운로드', '이미지가 다운로드되었어요. 직접 첨부해 공유해주세요.');
    return;
  }

  const Sharing = await import('expo-sharing');
  const uri = await captureToUri(ref);
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert('공유 불가', '이 기기에서 시스템 공유 시트를 사용할 수 없어요.');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '오운완 공유' });
}

/** 카드를 이미지로 저장 (네이티브: 갤러리, 웹: 다운로드) */
export async function saveCardImage(ref: CardRef): Promise<void> {
  if (Platform.OS === 'web') {
    const dataUrl = await captureToDataUrl(ref);
    downloadDataUrlOnWeb(dataUrl);
    return;
  }

  const MediaLibrary = await import('expo-media-library');
  // writeOnly=true: Android 13+ 의 "어느 사진 접근 허용?" 피커 UI 를 건너뛰고 쓰기 권한만 즉시 요청.
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) {
    Alert.alert('권한 필요', '사진 저장을 위해 갤러리 접근 권한이 필요해요.');
    return;
  }
  const uri = await captureToUri(ref, timestampedFileName());
  // FitBack 앨범 안에 저장 — 없으면 새로 생성, 있으면 그대로 추가.
  const album = await MediaLibrary.Album.get(ALBUM_NAME);
  if (album) {
    await MediaLibrary.Asset.create(uri, album);
  } else {
    const asset = await MediaLibrary.Asset.create(uri);
    await MediaLibrary.Album.create(ALBUM_NAME, [asset]);
  }
  Alert.alert('저장 완료', `갤러리의 '${ALBUM_NAME}' 앨범에 저장됐어요.`);
}

function downloadDataUrlOnWeb(dataUrl: string) {
  const doc = (globalThis as { document?: Document }).document;
  if (!doc) return;
  const a = doc.createElement('a');
  a.href = dataUrl;
  a.download = FILENAME;
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
}
