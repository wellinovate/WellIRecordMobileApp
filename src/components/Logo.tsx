import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface LogoProps {
  height?: number;
  color?: string;
  shieldColor?: string;
  markColor?: string;
}

interface LogoMarkProps {
  size?: number;
  shieldColor?: string;
  markColor?: string;
  strokeColor?: string;
}

/**
 * Standalone Shield Emblem Logo Mark
 */
export function LogoMark({
  size = 32,
  shieldColor = '#021F50',
  markColor = '#ffffff',
  strokeColor,
}: LogoMarkProps) {
  const width = Math.round(size * (100 / 120));

  return (
    <Svg width={width} height={size} viewBox="0 0 100 120" fill="none">
      {/* Shield Silhouette */}
      <Path
        d="M50 4
           C52 4, 86 11, 88 12.5
           C90 14, 91 16, 91 22
           L91 58
           C91 82, 72 104, 50 116
           C28 104, 9 82, 9 58
           L9 22
           C9 16, 10 14, 12 12.5
           C14 11, 48 4, 50 4 Z"
        fill={shieldColor}
        stroke={strokeColor || 'none'}
        strokeWidth={strokeColor ? 2 : 0}
      />
      {/* Outer Chevron */}
      <Path
        d="M15 98 L50 34 L85 98"
        fill="none"
        stroke={markColor}
        strokeWidth={8.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner Chevron */}
      <Path
        d="M31 106 L50 71 L69 106"
        fill="none"
        stroke={markColor}
        strokeWidth={8.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Plus Sign in Top Right */}
      <Path
        d="M78 23 V37 M71 30 H85"
        stroke={markColor}
        strokeWidth={4.2}
        strokeLinecap="square"
      />
    </Svg>
  );
}

/**
 * Full Brand Logo (Emblem + "WelliRecord" typography)
 */
export function Logo({
  height = 28,
  color = '#021F50',
  shieldColor = '#021F50',
  markColor = '#ffffff',
}: LogoProps) {
  // SVG original viewBox is 0 0 170 34
  const width = Math.round((height / 34) * 170);

  return (
    <Svg width={width} height={height} viewBox="0 0 170 34" fill="none">
      {/* Shield Mark Silhouette */}
      <Path
        d="M16 1.8
           C16.8 1.8, 27.2 4.4, 28 5.2
           C28.8 6.0, 29 7.2, 29 9.6
           L29 17.5
           C29 24.8, 23.4 29.4, 16 32.2
           C8.6 29.4, 3 24.8, 3 17.5
           L3 9.6
           C3 7.2, 3.2 6.0, 4 5.2
           C4.8 4.4, 15.2 1.8, 16 1.8 Z"
        fill={shieldColor}
      />

      {/* Outer Chevron */}
      <Path
        d="M6.2 25 L16.0 10.2 L25.8 25"
        fill="none"
        stroke={markColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Inner Chevron */}
      <Path
        d="M10.4 27.0 L16.0 18.6 L21.6 27.0"
        fill="none"
        stroke={markColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Plus Sign in Upper Right */}
      <Path
        d="M23.6 6.6 V11.0 M21.4 8.8 H25.8"
        stroke={markColor}
        strokeWidth={1.3}
        strokeLinecap="square"
      />

      {/* Brand Text "WelliRecord" */}
      {/* W */}
      <Path d="M37 9 L40.2 24 H42.8 L45.2 14.5 L47.6 24 H50.2 L53.4 9 H50.5 L48.8 18.5 L46.4 9 H44 L41.6 18.5 L39.9 9 Z" fill={color} />
      {/* e */}
      <Path d="M59.5 13.5 C56.5 13.5 54.5 15.6 54.5 18.8 C54.5 22 56.5 24.2 59.8 24.2 C61.8 24.2 63.3 23.3 64.1 21.8 L61.8 20.8 C61.3 21.6 60.5 22 59.7 22 C58.2 22 57.2 21 57.1 19.6 H64.5 C64.6 19.3 64.6 19 64.6 18.6 C64.6 15.5 62.6 13.5 59.5 13.5 Z M57.1 17.6 C57.4 16.3 58.3 15.4 59.5 15.4 C60.7 15.4 61.6 16.3 61.9 17.6 Z" fill={color} />
      {/* l */}
      <Path d="M67.5 7.5 H70.2 V24 H67.5 Z" fill={color} />
      {/* l */}
      <Path d="M73 7.5 H75.7 V24 H73 Z" fill={color} />
      {/* i */}
      <Path d="M78.5 7.5 H81.2 V10.2 H78.5 Z M78.5 13.8 H81.2 V24 H78.5 Z" fill={color} />
      {/* R */}
      <Path d="M86 9 H92 C94.8 9 96.5 10.5 96.5 12.8 C96.5 14.5 95.4 15.8 93.8 16.3 L97 24 H93.8 L91 17.2 H88.8 V24 H86 Z M88.8 14.9 H91.6 C92.9 14.9 93.7 14.1 93.7 12.9 C93.7 11.7 92.9 11.1 91.6 11.1 H88.8 Z" fill="#0EA5E9" />
      {/* e */}
      <Path d="M102.5 13.5 C99.5 13.5 97.5 15.6 97.5 18.8 C97.5 22 99.5 24.2 102.8 24.2 C104.8 24.2 106.3 23.3 107.1 21.8 L104.8 20.8 C104.3 21.6 103.5 22 102.7 22 C101.2 22 100.2 21 100.1 19.6 H107.5 C107.6 19.3 107.6 19 107.6 18.6 C107.6 15.5 105.6 13.5 102.5 13.5 Z M100.1 17.6 C100.4 16.3 101.3 15.4 102.5 15.4 C103.7 15.4 104.6 16.3 104.9 17.6 Z" fill="#0EA5E9" />
      {/* c */}
      <Path d="M114.5 13.5 C111.4 13.5 109.4 15.7 109.4 18.9 C109.4 22.1 111.4 24.3 114.6 24.3 C116.6 24.3 118.2 23.3 119 21.8 L116.7 20.6 C116.2 21.5 115.4 22 114.5 22 C113.1 22 112.1 20.9 112.1 18.9 C112.1 16.9 113.1 15.8 114.5 15.8 C115.4 15.8 116.2 16.3 116.7 17.2 L119 16 C118.2 14.5 116.6 13.5 114.5 13.5 Z" fill="#0EA5E9" />
      {/* o */}
      <Path d="M125.5 13.5 C122.3 13.5 120.2 15.7 120.2 18.9 C120.2 22.1 122.3 24.3 125.5 24.3 C128.7 24.3 130.8 22.1 130.8 18.9 C130.8 15.7 128.7 13.5 125.5 13.5 Z M125.5 22 C123.8 22 122.8 20.7 122.8 18.9 C122.8 17.1 123.8 15.8 125.5 15.8 C127.2 15.8 128.2 17.1 128.2 18.9 C128.2 20.7 127.2 22 125.5 22 Z" fill="#0EA5E9" />
      {/* r */}
      <Path d="M133.5 13.8 H136.1 V15.8 C136.8 14.4 138.1 13.6 139.7 13.6 L139.5 16.2 C137.6 16.2 136.2 17.4 136.2 19.5 V24 H133.5 Z" fill="#0EA5E9" />
      {/* d */}
      <Path d="M147 7.5 H149.7 V24 H147.2 V22.1 C146.4 23.5 144.9 24.3 143.1 24.3 C140 24.3 137.9 22.1 137.9 18.9 C137.9 15.7 140 13.5 143.1 13.5 C144.9 13.5 146.4 14.3 147.2 15.7 V7.5 Z M143.8 22 C145.5 22 147 20.7 147 18.9 C147 17.1 145.5 15.8 143.8 15.8 C142.1 15.8 140.6 17.1 140.6 18.9 C140.6 20.7 142.1 22 143.8 22 Z" fill="#0EA5E9" />
    </Svg>
  );
}
