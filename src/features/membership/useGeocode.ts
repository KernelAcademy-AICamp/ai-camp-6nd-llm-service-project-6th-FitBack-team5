// 주소/장소 검색 → 좌표. Supabase Edge Function(geocode) 프록시를 통해 카카오 Local
// 키워드 검색을 호출한다 (웹 CORS 우회, 카카오 키는 Edge Function 시크릿에만 존재).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface GeoResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/** 키워드로 장소/주소 후보를 검색. 미설정/실패 시 throw. */
export async function searchPlaces(query: string): Promise<GeoResult[]> {
  if (!SUPABASE_URL || !ANON) throw new Error('검색 서비스가 설정되지 않았어요.');
  const q = query.trim();
  if (!q) return [];
  const r = await fetch(`${SUPABASE_URL}/functions/v1/geocode?query=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${ANON}`, apikey: ANON },
  });
  if (!r.ok) throw new Error('주소 검색에 실패했어요.');
  const j = (await r.json()) as { results?: GeoResult[]; error?: string };
  if (j.error) throw new Error(j.error);
  return j.results ?? [];
}
