/**
 * Palette M3ak : mauve et blanc. Voir docs/PRODUIT.md et docs/design/.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const M3akPalette = {
  mauve: '#7C3AED',
  mauveDeep: '#5B21B6',
  mauveLight: '#EDE9FE',
  background: '#FAF9FF',
  success: '#15803D',
  successLight: '#DCFCE7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  warning: '#B45309',
  warningLight: '#FEF3C7',
} as const;

export const Colors = {
  light: {
    text: '#211A2E',
    background: M3akPalette.background,
    backgroundElement: '#FFFFFF',
    backgroundSelected: M3akPalette.mauveLight,
    textSecondary: '#81778F',
    primary: M3akPalette.mauve,
    accent: M3akPalette.mauveDeep,
    success: M3akPalette.success,
    warning: M3akPalette.warning,
    danger: M3akPalette.danger,
    border: '#EAE5F2',
  },
  dark: {
    text: '#F5F2FC',
    background: '#17101F',
    backgroundElement: '#231A2E',
    backgroundSelected: '#36204F',
    textSecondary: '#B3A6C2',
    primary: M3akPalette.mauve,
    accent: '#C4B5FD',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    border: '#33243F',
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
