import { Platform } from 'react-native';

// 웹(react-native-web)에선 Modal presentationStyle="pageSheet"가 제대로 렌더되지 않아
// 상세/폼 모달이 안 보이는 이슈가 있다. 웹은 기본(fullScreen) 모달로 분기한다.
export const sheetPresentation = Platform.OS === 'web' ? undefined : ('pageSheet' as const);
