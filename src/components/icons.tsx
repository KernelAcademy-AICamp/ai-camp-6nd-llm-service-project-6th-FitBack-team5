import Svg, { Circle, G, Line, Path } from 'react-native-svg';

type IconProps = {
  color: string;
  size?: number;
};

export function IconMenu({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="3" y1="18" x2="21" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function IconHome({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.663 2.20137C12.2664 1.93288 11.7336 1.93288 11.337 2.20137L1.45854 8.88841C0.937215 9.24131 0.817787 9.9589 1.19671 10.4616C1.54935 10.9295 2.2068 11.0389 2.69198 10.7105L11.9999 4.40962L21.308 10.7105C21.7932 11.0389 22.4506 10.9295 22.8033 10.4616C23.1822 9.9589 23.0628 9.2413 22.5414 8.88839L12.663 2.20137ZM20.6482 13.0122L12.663 7.60678C12.2664 7.33828 11.7336 7.33828 11.337 7.60678L3.35183 13.0122C3.05206 13.2151 2.87414 13.5427 2.87414 13.8919V20.9189C2.87414 21.516 3.38485 22 4.01487 22H19.9851C20.6151 22 21.1258 21.516 21.1258 20.9189V13.8919C21.1258 13.5427 20.948 13.2151 20.6482 13.0122Z"
        fill={color}
      />
    </Svg>
  );
}

export function IconFood({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.0002 20C19.0001 20.5304 18.7893 21.039 18.4142 21.4141C18.0392 21.789 17.5305 22 17.0002 22H7.00017C6.46986 21.9999 5.96111 21.7891 5.58611 21.4141C5.21117 21.039 5.00021 20.5303 5.00017 20V18H19.0002V20ZM12.0002 1.99609C13.1729 1.99609 14.3204 2.33947 15.3 2.98438C16.085 3.50125 16.7347 4.19385 17.2004 5.00293C18.1304 5.03928 19.0369 5.33497 19.8146 5.86328C20.7895 6.5256 21.4995 7.51095 21.8185 8.64551C22.1375 9.78 22.0455 10.9912 21.5588 12.0645C21.0721 13.1372 20.2214 14.0023 19.1584 14.5098L19.1593 14.5107C19.0897 14.5442 19.0414 14.5884 19.0168 14.6221C18.9957 14.6511 19 14.6596 19.0002 14.6504V16H5.00017V14.6494C5.0003 14.6596 5.00513 14.6517 4.98357 14.6221C4.95898 14.5884 4.91117 14.5446 4.84197 14.5107L4.64568 14.4111C3.67478 13.8934 2.89931 13.0685 2.44353 12.0625C1.95752 10.9897 1.86593 9.77933 2.18474 8.64551C2.50361 7.5117 3.21276 6.52655 4.18669 5.86426C4.96382 5.3359 5.87036 5.03985 6.79997 5.00293C7.26562 4.19392 7.91543 3.50126 8.70037 2.98438C9.67984 2.33948 10.8275 1.99616 12.0002 1.99609Z"
        fill={color}
      />
    </Svg>
  );
}

export function IconFit({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.5 6H2.83333C2.47971 6 2.14057 6.15804 1.89052 6.43934C1.64048 6.72064 1.5 7.10218 1.5 7.5V16.5C1.5 16.8978 1.64048 17.2794 1.89052 17.5607C2.14057 17.842 2.47971 18 2.83333 18H5.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.5 5.33333V18.6667C5.5 19.0203 5.64048 19.3594 5.89052 19.6095C6.14057 19.8595 6.47971 20 6.83333 20H8.16667C8.52029 20 8.85943 19.8595 9.10948 19.6095C9.35952 19.3594 9.5 19.0203 9.5 18.6667V5.33333C9.5 4.97971 9.35952 4.64057 9.10948 4.39052C8.85943 4.14048 8.52029 4 8.16667 4H6.83333C6.47971 4 6.14057 4.14048 5.89052 4.39052C5.64048 4.64057 5.5 4.97971 5.5 5.33333Z"
        fill={color}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.5 12H14.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.5 5.33333V18.6667C14.5 19.0203 14.6405 19.3594 14.8905 19.6095C15.1406 19.8595 15.4797 20 15.8333 20H17.1667C17.5203 20 17.8594 19.8595 18.1095 19.6095C18.3595 19.3594 18.5 19.0203 18.5 18.6667V5.33333C18.5 4.97971 18.3595 4.64057 18.1095 4.39052C17.8594 4.14048 17.5203 4 17.1667 4H15.8333C15.4797 4 15.1406 4.14048 14.8905 4.39052C14.6405 4.64057 14.5 4.97971 14.5 5.33333Z"
        fill={color}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.5 6H21.1667C21.5203 6 21.8594 6.15804 22.1095 6.43934C22.3595 6.72064 22.5 7.10218 22.5 7.5V16.5C22.5 16.8978 22.3595 17.2794 22.1095 17.5607C21.8594 17.842 21.5203 18 21.1667 18H18.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconCalendar({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 11H22V20.9C22 21.5075 21.5523 22 21 22H3C2.44772 22 2 21.5075 2 20.9V11ZM17 2.2H21C21.5523 2.2 22 2.69249 22 3.3V8.8H2V3.3C2 2.69249 2.44772 2.2 3 2.2H7V1C7 0.447715 7.44772 0 8 0C8.55228 0 9 0.447715 9 1V2.2H15V1C15 0.447715 15.4477 0 16 0C16.5523 0 17 0.447715 17 1V2.2Z"
        fill={color}
      />
    </Svg>
  );
}

export function IconArrowChevron({
  color = '#9CA3AF',
  size = 20,
  direction = 'right',
}: {
  color?: string;
  size?: number;
  direction?: 'left' | 'right';
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <G transform={direction === 'left' ? 'translate(20,0) scale(-1,1)' : undefined}>
        <Path
          d="M7.5 5L12.5 10L7.5 15"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}

export function IconArrowCircle({
  size = 36,
  bgColor = 'rgba(255,255,255,0.2)',
}: {
  size?: number;
  bgColor?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Circle cx="18" cy="18" r="18" fill={bgColor} />
      <Path
        d="M11 18H23M19.5 14L23 18L19.5 22"
        stroke="white"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconBell({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.2322 1.62763C9.76339 2.02949 9.5 2.57454 9.5 3.14286C8.06449 3.72467 6.84075 4.63035 5.95994 5.76282C5.07913 6.89529 4.57445 8.21186 4.5 9.57143V12.7857C4.40593 13.4518 4.13071 14.0897 3.69648 14.648C3.26226 15.2063 2.68117 15.6694 2 16H22C21.3188 15.6694 20.7377 15.2063 20.3035 14.648C19.8693 14.0897 19.5941 13.4518 19.5 12.7857V9.57143C19.4256 8.21186 18.9209 6.89529 18.0401 5.76282C17.1593 4.63035 15.9355 3.72467 14.5 3.14286C14.5 2.57454 14.2366 2.02949 13.7678 1.62763C13.2989 1.22576 12.663 1 12 1C11.337 1 10.7011 1.22576 10.2322 1.62763Z"
        fill={color}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 20V20.25C15 20.9577 14.7006 21.6504 14.1445 22.1719C13.5861 22.6954 12.8157 23 12 23C11.1843 23 10.4139 22.6954 9.85547 22.1719C9.29935 21.6504 9 20.9577 9 20.25V20H15Z"
        fill={color}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
