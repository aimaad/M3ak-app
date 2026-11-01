/**
 * Palette officielle M3ak (mauve) : voir docs/DESIGN.md.
 *
 * Les noms historiques (`mauve`, `mauveDeep`…) sont des RÔLES : `mauve` = mauve signature (boutons, navigation, texte et
 * icônes d'action), `mauveDeep` = mauve profond (hero, cartes premium). Les couleurs fonctionnelles (`success`, `info`,
 * `warning`, `danger`, `neutral`) servent aux pastilles, icônes et fonds ; pour du TEXTE sur clair on prend la variante
 * `*Text`, plus foncée (les teintes d'origine n'atteignent pas 4,5:1 sur blanc, l'ambre d'à peine 2,5:1).
 */

import { Platform } from 'react-native';

export const M3akPalette = {
  /** Mauve signature : boutons, navigation, liens. 7,45:1 avec du texte blanc, 6,9:1 sur le fond ivoire. */
  mauve: '#9438D8',
  /** Mauve profond : hero, cartes premium, onglet actif (blanc dessus : 14:1). */
  mauveDeep: '#321943',
  mauveLight: '#F3E7FC',
  mauveSoft: '#F7EEFD',
  /** Lavande douce : accents et éléments secondaires, surtout sur fond sombre (5,8:1 sur le mauve profond). */
  lavender: '#CB83F5',
  /** Noir aubergine : fonds sombres et titres. */
  aubergine: '#171126',
  /** Blanc ivoire : fond principal. */
  background: '#F8F3FC',
  /** Blanc pur : cartes et surfaces. */
  surface: '#FFFFFF',
  ink: '#171126',
  /** Texte secondaire : au moins 4,5:1 sur blanc, sur le fond et sur les teintes claires. */
  muted: '#675A7E',
  /** Icônes et textes d'appoint inactifs : 3:1 sur blanc, jamais pour du texte courant. */
  subtle: '#9686AE',
  border: '#EADCF5',
  /** Disponible / succès. */
  success: '#17856A',
  successText: '#116B54',
  successLight: '#E3F3EE',
  /** En location / information. */
  info: '#5479C7',
  infoText: '#3F62AD',
  infoLight: '#E8EEF9',
  /** Maintenance / attention (le texte sur ambre est le noir aubergine : 7,4:1). */
  warning: '#D99835',
  warningText: '#8A5A0B',
  warningLight: '#FBF1DE',
  /** Retard / erreur. */
  danger: '#C55461',
  dangerText: '#A83C4B',
  dangerLight: '#F8E6E9',
  /** Indisponible / neutre. */
  neutral: '#9692A3',
  neutralText: '#675A7E',
  neutralLight: '#EFEEF3',
  /** Remplissage du bouton principal (même mauve signature) et son état appuyé. */
  primary: '#9438D8',
  primaryPressed: '#7E2BBE',
  /** Texte sur le bouton principal : 7,45:1. */
  onPrimary: '#FFFFFF',
} as const;

/** Ombres légères teintées de mauve profond (jamais un gris ou un noir pur) : bordures et espaces d'abord. */
export const Shadows = {
  card: { shadowColor: '#321943', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  raised: { shadowColor: '#321943', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  button: { shadowColor: '#9438D8', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
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
    success: M3akPalette.successText,
    warning: M3akPalette.warningText,
    danger: M3akPalette.dangerText,
    border: M3akPalette.border,
  },
  dark: {
    text: '#F5F2FC',
    background: '#171126',
    backgroundElement: '#211A2E',
    backgroundSelected: '#321943',
    textSecondary: '#B3AEC2',
    primary: M3akPalette.lavender,
    accent: M3akPalette.lavender,
    success: '#4ADE80',
    warning: '#D99835',
    danger: '#E08A94',
    border: '#2E2640',
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
 * Typographie M3ak : Plus Jakarta Sans pour le latin (titres, chiffres), Cairo pour l'arabe (Plus Jakarta n'a pas
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
