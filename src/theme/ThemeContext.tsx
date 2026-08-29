import { createContext, useContext } from 'react';
import type { Theme } from '../data/types';
import { DARK_THEME, LIGHT_THEME } from '../data/mockData';

export const ThemeContext = createContext<Theme>(LIGHT_THEME);

export function useTheme() {
  return useContext(ThemeContext);
}

export function themeFor(darkMode: boolean): Theme {
  return darkMode
    ? { ...DARK_THEME, darkMode: true }
    : { ...LIGHT_THEME, darkMode: false };
}
