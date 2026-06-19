import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type ThemedTextProps = React.ComponentProps<typeof ThemedText>;

/** 0 → value로 숫자가 차오르는 카운트업 텍스트. 분석 결과가 "살아있는" 느낌을 준다. */
export function CountUp({
  value,
  format,
  suffix,
  duration = 700,
  ...rest
}: {
  value: number;
  format?: (n: number) => string;
  suffix?: string;
  duration?: number;
} & Omit<ThemedTextProps, 'children'>) {
  const [anim] = useState(() => new Animated.Value(0));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setDisplay(v * value));
    Animated.timing(anim, { toValue: 1, duration, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value, duration, anim]);

  const n = Math.round(display);
  return (
    <ThemedText {...rest}>
      {(format ? format(n) : String(n)) + (suffix ?? '')}
    </ThemedText>
  );
}
