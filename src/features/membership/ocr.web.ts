// 웹은 ML Kit(네이티브 온디바이스)을 지원하지 않는다. 수동 입력으로 안내.
export async function recognizeText(_uri: string): Promise<string> {
  throw new Error('웹에서는 영수증 스캔을 지원하지 않습니다. 직접 입력해 주세요.');
}
