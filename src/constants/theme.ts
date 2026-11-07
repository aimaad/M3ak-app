/**
 * Identité BIBIP : graphite + orange. Les valeurs vivent dans `brand.js` (source de vérité, partagée avec `tailwind.config.js`) ;
 * voir docs/DESIGN.md. Les composants utilisent ces tokens sémantiques, jamais de valeur hex directement.
 *
 * Règles d'usage : orange réservé aux actions et aux accents (≈ 10 % de l'écran), un seul bouton orange plein par écran, texte
 * blanc sur orange en 16 px gras minimum, texte orange (`accentText`) en 16 px ou gras seulement, le rouge `error` jamais pour
 * une action non destructive, pas de dégradé, pas d'ombre colorée.
 */

import { Platform } from 'react-native';

import { brand as BrandColors, dark as DarkTokens, light as LightTokens } from './brand';

/** Couleurs de marque (graphite, orange, orange clair, blanc). */
export const Brand = BrandColors;
/** Thèmes sémantiques. L'app est en mode clair forcé ; le thème sombre est prêt mais pas encore branché. */
export const Themes = { light: LightTokens, dark: DarkTokens } as const;
/** Palette courante de l'app (thème clair forcé). */
export const Palette = LightTokens;

/**
 * Ombres : AUCUNE ombre teintée. Seuls les éléments flottants (bouton « + », barre fixe, bottom sheets, modales) ont une ombre
 * neutre très légère (grise, faible opacité). Les cartes n'ont pas d'ombre : fond blanc et bordure.
 */
export const Shadows = {
  card: {},
  raised: { shadowColor: Palette.shadow, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  button: {},
} as const;

export const Colors = {
  light: {
    text: LightTokens.textPrimary,
    background: LightTokens.background,
    backgroundElement: LightTokens.card,
    backgroundSelected: LightTokens.primarySoft,
    textSecondary: LightTokens.textSecondary,
    primary: LightTokens.primary,
    accent: LightTokens.accentText,
    success: LightTokens.success,
    warning: LightTokens.warning,
    danger: LightTokens.error,
    border: LightTokens.border,
  },
  dark: {
    text: DarkTokens.textPrimary,
    background: DarkTokens.background,
    backgroundElement: DarkTokens.card,
    backgroundSelected: DarkTokens.primarySoft,
    textSecondary: DarkTokens.textSecondary,
    primary: DarkTokens.primary,
    accent: DarkTokens.accentText,
    success: DarkTokens.success,
    warning: DarkTokens.warning,
    danger: DarkTokens.error,
    border: DarkTokens.border,
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

/** Police du texte « bibip » dans le logo (Montserrat SemiBold 600), chargée au démarrage (`_layout.tsx`). */
export const BRAND_FONT = 'Montserrat_600SemiBold';

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
