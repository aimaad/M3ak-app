/**
 * Design system Kriha (vert premium) : voir docs/DESIGN.md et .claude/skills/kriha-ui-designer/references/design-system.md.
 *
 * Les noms historiques (`mauve`, `mauveDeep`…) sont conservés pour ne pas toucher des centaines de lignes : ce sont des
 * RÔLES, pas des couleurs. `mauve` = couleur d'action (texte et icônes sur clair, fond portant du texte blanc) ;
 * `mauveDeep` = vert forêt (cartes vedettes, titres). L'émeraude vif `emerald` est réservé au bouton principal, avec
 * du texte très foncé (`onEmerald`) car du blanc sur `#00B884` n'atteint que 2,56:1.
 */

import { Platform } from 'react-native';

export const M3akPalette = {
  /** Action : 5,35:1 avec du texte blanc, 4,73:1 sur la teinte claire. */
  mauve: '#007A59',
  /** Vert forêt : cartes vedettes, grands titres, onglet actif (blanc dessus : 9,7:1). */
  mauveDeep: '#064E3B',
  mauveLight: '#E3F5EE',
  mauveSoft: '#EEF7F3',
  background: '#F5FAF8',
  surface: '#FFFFFF',
  ink: '#172B26',
  /** Texte secondaire : au moins 4,5:1 sur blanc, sur le fond et sur les teintes claires. */
  muted: '#566774',
  /** Icônes et textes d'appoint inactifs : 3:1 sur blanc, jamais pour du texte courant. */
  subtle: '#778894',
  border: '#E5EDE9',
  success: '#15803D',
  successLight: '#DCFCE7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  warning: '#B45309',
  warningLight: '#FEF3C7',
  info: '#2563EB',
  infoLight: '#DBEAFE',
  /** Émeraude Kriha : bouton principal, pastille d'onglet, accents sur forêt. Jamais pour du petit texte. */
  emerald: '#00B884',
  emeraldPressed: '#008F69',
  /** Texte sur émeraude : 6,2:1. */
  onEmerald: '#04271E',
  /** Accent éditorial sur forêt (5,3:1), à utiliser avec parcimonie. */
  gold: '#F2B35D',
} as const;

/** Ombres légères teintées de vert forêt (jamais un gris ou un noir pur) : bordures et espaces d'abord. */
export const Shadows = {
  card: { shadowColor: '#064E3B', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  raised: { shadowColor: '#064E3B', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  button: { shadowColor: '#00B884', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
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
    background: '#0E1C18',
    backgroundElement: '#14261F',
    backgroundSelected: '#1D3A30',
    textSecondary: '#94A3B8',
    primary: M3akPalette.mauve,
    accent: '#6EE7B7',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    border: '#1F3A32',
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

export type FontWeightName = 'medium' | 'semibold' | 'bold' | 'extrabold';

/**
 * Typographie Kriha : Plus Jakarta Sans pour le latin (titres, chiffres), Cairo pour l'arabe (Plus Jakarta n'a pas
 * de glyphes arabes). Un fichier de police par graisse : on ne s'appuie pas sur `fontWeight` avec une police perso.
 */
export const Typefaces = {
  latin: { medium: 'PlusJakartaSans_500Medium', semibold: 'PlusJakartaSans_600SemiBold', bold: 'PlusJakartaSans_700Bold', extrabold: 'PlusJakartaSans_800ExtraBold' },
  arabic: { medium: 'Cairo_500Medium', semibold: 'Cairo_600SemiBold', bold: 'Cairo_700Bold', extrabold: 'Cairo_700Bold' },
} as const;

export function fontFamilyFor(language: string | undefined, weight: FontWeightName): string {
  return (language === 'ar' ? Typefaces.arabic : Typefaces.latin)[weight];
}

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
