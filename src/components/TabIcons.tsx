import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import type { Tab } from '../data/types';

interface IconProps {
  color: string;
  weight: number | string;
}

export function TabIcon({ tab, color, weight }: IconProps & { tab: Tab }) {
  const w = typeof weight === 'string' ? parseFloat(weight) || 1.8 : weight;

  switch (tab) {
    case 'home':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 11l8-7 8 7M6 10v9h12v-9"
            stroke={color}
            strokeWidth={w}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'records':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Rect x={5} y={3} width={14} height={18} rx={2} stroke={color} strokeWidth={w} />
          <Path
            d="M8.5 8h7M8.5 12h7M8.5 16h4"
            stroke={color}
            strokeWidth={w}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'share':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Circle cx={6} cy={12} r={2.6} stroke={color} strokeWidth={w} />
          <Circle cx={17} cy={6} r={2.6} stroke={color} strokeWidth={w} />
          <Circle cx={17} cy={18} r={2.6} stroke={color} strokeWidth={w} />
          <Path
            d="M8.3 10.8l6.4-3.6M8.3 13.2l6.4 3.6"
            stroke={color}
            strokeWidth={w}
          />
        </Svg>
      );
    case 'care':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 20s-7-4.4-7-10a4.5 4.5 0 018-2.8A4.5 4.5 0 0121 10c0 5.6-7 10-7 10z"
            stroke={color}
            strokeWidth={w}
          />
        </Svg>
      );
    case 'profile':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={3.6} stroke={color} strokeWidth={w} />
          <Path
            d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5"
            stroke={color}
            strokeWidth={w}
            strokeLinecap="round"
          />
        </Svg>
      );
  }
}
