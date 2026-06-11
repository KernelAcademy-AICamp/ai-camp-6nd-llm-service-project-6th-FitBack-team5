import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Palette, Radius } from '@/constants/theme';

// 카카오맵 JS SDK (웹). JavaScript 키 + [플랫폼 키]>[JavaScript 키]의 SDK 도메인 등록 필요.
const JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY;
let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof document === 'undefined') return Promise.reject(new Error('no document'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.kakao?.maps) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&autoload=false`;
    s.async = true;
    s.onload = () => w.kakao.maps.load(() => resolve());
    s.onerror = () => reject(new Error('kakao sdk load failed'));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

let counter = 0;

type Pt = { lat: number; lng: number };

export function KakaoMap({
  lat,
  lng,
  label,
  height = 200,
  origin,
  current,
  showLine,
}: {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
  origin?: Pt | null;
  current?: Pt | null;
  showLine?: boolean;
}) {
  const idRef = useRef(`kakao-map-${counter++}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const curOverlayRef = useRef<any>(null);

  // 지도 초기화 (도착지/출발지/경로선).
  useEffect(() => {
    let cancelled = false;
    loadSdk()
      .then(() => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const kakao = (window as any).kakao;
        const el = document.getElementById(idRef.current);
        if (!el || !kakao?.maps) return;
        const dest = new kakao.maps.LatLng(lat, lng);
        const map = new kakao.maps.Map(el, { center: dest, level: 5 });
        mapRef.current = map;

        const destMarker = new kakao.maps.Marker({ position: dest });
        destMarker.setMap(map);
        if (label) {
          new kakao.maps.InfoWindow({
            content: `<div style="padding:5px 10px;font-size:12px;white-space:nowrap;">${label}</div>`,
          }).open(map, destMarker);
        }

        if (origin && showLine) {
          const start = new kakao.maps.LatLng(origin.lat, origin.lng);
          new kakao.maps.Polyline({
            path: [start, dest],
            strokeWeight: 4,
            strokeColor: '#6675FF',
            strokeOpacity: 0.9,
            strokeStyle: 'solid',
          }).setMap(map);
          const bounds = new kakao.maps.LatLngBounds();
          bounds.extend(start);
          bounds.extend(dest);
          map.setBounds(bounds);
        }

        // 현재 위치 점(파란 dot) 오버레이 — 이후 current 변경 시 위치만 갱신.
        const dot = document.createElement('div');
        dot.style.cssText =
          'width:14px;height:14px;background:#6675FF;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 2px #6675FF;';
        const overlay = new kakao.maps.CustomOverlay({ content: dot, position: dest, zIndex: 10 });
        curOverlayRef.current = overlay;
        if (current) {
          overlay.setPosition(new kakao.maps.LatLng(current.lat, current.lng));
          overlay.setMap(map);
        }
      })
      .catch(() => {
        /* 미등록 도메인/키 오류는 콘솔에 표시됨 */
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, label, origin?.lat, origin?.lng, showLine]); // eslint-disable-line react-hooks/exhaustive-deps

  // 현재 위치만 실시간 갱신 (지도 재생성 없이 마커 이동).
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao;
    const map = mapRef.current;
    const overlay = curOverlayRef.current;
    if (!kakao?.maps || !map || !overlay || !current) return;
    overlay.setPosition(new kakao.maps.LatLng(current.lat, current.lng));
    overlay.setMap(map);
  }, [current?.lat, current?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <View nativeID={idRef.current} style={[styles.map, { height }]} />;
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Palette.gray100,
  },
});
