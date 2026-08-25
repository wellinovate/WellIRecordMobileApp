import type { Tab } from '../data/types';

interface IconProps {
  color: string;
  weight: string;
}

export function TabIcon({ tab, color, weight }: IconProps & { tab: Tab }) {
  const w = weight;
  switch (tab) {
    case 'home':
      return (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
          <path d="M4 11l8-7 8 7M6 10v9h12v-9" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'records':
      return (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="3" width="14" height="18" rx="2" stroke={color} strokeWidth={w} />
          <path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke={color} strokeWidth={w} strokeLinecap="round" />
        </svg>
      );
    case 'share':
      return (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
          <circle cx="6" cy="12" r="2.6" stroke={color} strokeWidth={w} />
          <circle cx="17" cy="6" r="2.6" stroke={color} strokeWidth={w} />
          <circle cx="17" cy="18" r="2.6" stroke={color} strokeWidth={w} />
          <path d="M8.3 10.8l6.4-3.6M8.3 13.2l6.4 3.6" stroke={color} strokeWidth={w} />
        </svg>
      );
    case 'care':
      return (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 20s-7-4.4-7-10a4.5 4.5 0 018-2.8A4.5 4.5 0 0121 10c0 5.6-7 10-7 10z"
            stroke={color}
            strokeWidth={w}
          />
        </svg>
      );
    case 'profile':
      return (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3.6" stroke={color} strokeWidth={w} />
          <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" stroke={color} strokeWidth={w} strokeLinecap="round" />
        </svg>
      );
  }
}

export const TAB_ORDER: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'records', label: 'Records' },
  { key: 'share', label: 'Share' },
  { key: 'care', label: 'Care' },
  { key: 'profile', label: 'Profile' },
];
