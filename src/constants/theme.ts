/**
 * Palette officielle BIBIP « Emerald Ivory » : les valeurs vivent dans `brand.js` (source de vérité, partagée avec
 * `tailwind.config.js`) ; voir docs/DESIGN.md.
 *
 * Les noms sont des RÔLES : `primary` = émeraude signature (boutons, navigation, texte et icônes d'action), `primaryDeep` =
 * émeraude profond (hero, cartes premium). Les couleurs fonctionnelles (`success`, `info`, `warning`, `danger`, `neutral`)
 * servent aux pastilles, icônes et fonds ; pour du TEXTE sur clair on prend la variante `*Text`, plus foncée.
 * Le logo BIBIP n'est jamais recoloré : ses couleurs sont celles du fichier fourni.
 */

import { Platform } from 'react-native';

import { BRAND, brand as BrandColors, dark as DarkTokens, light as LightTokens } from './brand';

export const BibipPalette = BRAND;

/** Couleurs de marque (graphite, orange, orange clair, blanc). */
export const Brand = BrandColors;
/** Thèmes sémantiques (voir `brand.js`). L'app est en mode clair forcé ; le thème sombre est prêt mais pas encore branché. */
export const Themes = { light: LightTokens, dark: DarkTokens } as const;
/** Palette courante de l'app (thème clair forcé). */
export const Palette = LightTokens;

/** Ombres légères teintées d'émeraude profond (jamais un gris ou un noir pur) : bordures et espaces d'abord. */
export const Shadows = {
  card: { shadowColor: BRAND.primaryDeep, shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  raised: { shadowColor: BRAND.primaryDeep, shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  button: { shadowColor: BRAND.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
} as const;

export const Colors = {
  light: {
    text: BibipPalette.ink,
    background: BibipPalette.background,
    backgroundElement: BibipPalette.surface,
    backgroundSelected: BibipPalette.primaryLight,
    textSecondary: BibipPalette.muted,
    primary: BibipPalette.primary,
    accent: BibipPalette.primaryDeep,
    success: BibipPalette.successText,
    warning: BibipPalette.warningText,
    danger: BibipPalette.dangerText,
    border: BibipPalette.border,
  },
  dark: {
    text: '#F2F6F4',
    background: BibipPalette.night,
    backgroundElement: '#0E2D28',
    backgroundSelected: BibipPalette.primaryDeep,
    textSecondary: '#A9BDB8',
    primary: BibipPalette.mint,
    accent: BibipPalette.mint,
    success: '#6FD08C',
    warning: BibipPalette.warning,
    danger: '#E88A82',
    border: '#1B3F39',
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
 * Typographie BIBIP : Plus Jakarta Sans pour le latin (titres, chiffres), Cairo pour l'arabe (Plus Jakarta n'a pas
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
