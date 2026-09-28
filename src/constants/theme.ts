/**
 * Palette M3ak : bleu, cyan, jaune, fond clair. Voir docs/PRODUIT.md et docs/design/.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const M3akPalette = {
  blue: '#1f5eff',
  cyan: '#38e1ff',
  yellow: '#ffd43b',
  background: '#f4f6fb',
} as const;

export const Colors = {
  light: {
    text: '#101423',
    background: M3akPalette.background,
    backgroundElement: '#ffffff',
    backgroundSelected: '#e5ebfd',
    textSecondary: '#5b6478',
    primary: M3akPalette.blue,
    accent: M3akPalette.cyan,
    warning: M3akPalette.yellow,
    border: '#e1e5f0',
  },
  dark: {
    text: '#f4f6fb',
    background: '#0d1120',
    backgroundElement: '#161b2e',
    backgroundSelected: '#1f2740',
    textSecondary: '#9aa3bd',
    primary: M3akPalette.blue,
    accent: M3akPalette.cyan,
    warning: M3akPalette.yellow,
    border: '#242c45',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  default: {
    sans: 'Cairo_400Regular',
    sansMedium: 'Cairo_500Medium',
    sansSemiBold: 'Cairo_600SemiBold',
    sansBold: 'Cairo_700Bold',
    mono: 'ui-monospace',
  },
  web: {
    sans: 'var(--font-display)',
    sansMedium: 'var(--font-display)',
    sansSemiBold: 'var(--font-display)',
    sansBold: 'var(--font-display)',
    mono: 'var(--font-mono)',
  },
})!;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
