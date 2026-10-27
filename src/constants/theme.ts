/**
 * Palette M3ak : mauve et blanc. Voir docs/PRODUIT.md et docs/design/.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const M3akPalette = {
  // Marque (les 10 % d'accent) : violet vif ; le reste de l'écran est neutre.
  mauve: '#7C3AED',
  mauveDeep: '#5B21B6',
  mauveLight: '#EDE9FE',
  mauveSoft: '#F5F0FF',
  background: '#F7F4FF',
  surface: '#FFFFFF',
  ink: '#1E1633',
  /** Texte secondaire : 6,5:1 sur blanc (le gris précédent n'atteignait pas 4,5:1). */
  muted: '#5E5575',
  /** Icônes et textes d'appoint inactifs : 3,6:1 sur blanc, jamais pour du texte courant. */
  subtle: '#8A82A0',
  border: '#E4DCF5',
  success: '#15803D',
  successLight: '#DCFCE7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  warning: '#B45309',
  warningLight: '#FEF3C7',
  info: '#2563EB',
  infoLight: '#DBEAFE',
} as const;

/** Ombre douce teintée de violet (jamais un gris ou un noir pur sur fond coloré). */
export const Shadows = {
  card: { shadowColor: '#5B21B6', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  raised: { shadowColor: '#5B21B6', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  button: { shadowColor: '#7C3AED', shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
} as const;

export const Colors = {
  light: {
    text: M3akPalette.ink,
    background: M3akPalette.background,
    backgroundElement: '#FFFFFF',
    backgroundSelected: M3akPalette.mauveLight,
    textSecondary: M3akPalette.muted,
    primary: M3akPalette.mauve,
    accent: M3akPalette.mauveDeep,
    success: M3akPalette.success,
    warning: M3akPalette.warning,
    danger: M3akPalette.danger,
    border: M3akPalette.border,
  },
  dark: {
    text: '#F5F2FC',
    background: '#17101F',
    backgroundElement: '#231A2E',
    backgroundSelected: '#36204F',
    textSecondary: '#8A82A0',
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
