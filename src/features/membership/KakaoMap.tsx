import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Palette, Radius } from '@/constants/theme';

// 네이티브 KakaoMap — WebView로 Kakao JS 지도를 임베드.
// baseUrl을 등록된 웹 도메인으로 지정해 Kakao 도메인(referer) 검사를 통과시킨다.
// (웹은 KakaoMap.web.tsx가 JS SDK를 직접 사용)
const JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';
// Kakao Developers > 플랫폼 > Web 사이트 도메인에 등록된 값과 일치해야 함.
const BASE_URL = 'https://fitback-myeongjin.vercel.app';

type Pt = { lat: number; lng: number };

function buildHtml(opts: {
  lat: number;
  lng: number;
  label?: string;
  origin?: Pt | null;
  current?: Pt | null;
  showLine?: boolean;
}): string {
  // 값은 JSON.stringify로 안전하게 주입.
  const lat = JSON.stringify(opts.lat);
  const lng = JSON.stringify(opts.lng);
  const label = JSON.stringify(opts.label ?? '');
  const origin = JSON.stringify(opts.origin ?? null);
  const current = JSON.stringify(opts.current ?? null);
  const showLine = JSON.stringify(!!opts.showLine);
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#F3F4F6;}</style>
</head><body><div id="map"></div>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&autoload=false"></script>
<script>
  kakao.maps.load(function () {
    var lat=${lat}, lng=${lng}, label=${label}, origin=${origin}, current=${current}, showLine=${showLine};
    var dest=new kakao.maps.LatLng(lat,lng);
    var map=new kakao.maps.Map(document.getElementById('map'),{center:dest,level:5});
    var marker=new kakao.maps.Marker({position:dest}); marker.setMap(map);
    if(label){ new kakao.maps.InfoWindow({content:'<div style="padding:5px 10px;font-size:12px;white-space:nowrap;">'+label+'</div>'}).open(map,marker); }
    if(origin && showLine){
      var start=new kakao.maps.LatLng(origin.lat,origin.lng);
      new kakao.maps.Polyline({path:[start,dest],strokeWeight:4,strokeColor:'#6675FF',strokeOpacity:0.9,strokeStyle:'solid'}).setMap(map);
      var b=new kakao.maps.LatLngBounds(); b.extend(start); b.extend(dest); map.setBounds(b);
    }
    if(current){
      var dot=document.createElement('div');
      dot.style.cssText='width:14px;height:14px;background:#6675FF;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 2px #6675FF;';
      new kakao.maps.CustomOverlay({content:dot,position:new kakao.maps.LatLng(current.lat,current.lng),zIndex:10}).setMap(map);
    }
  });
</script></body></html>`;
}

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
  const html = useMemo(
    () => buildHtml({ lat, lng, label, origin, current, showLine }),
    [lat, lng, label, origin, current, showLine],
  );

  return (
    <View style={[styles.map, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: BASE_URL }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        // 지도 타일 표시 안정화
        androidLayerType="hardware"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Palette.gray100,
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
