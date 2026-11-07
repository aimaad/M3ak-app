import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Brand, homeDisplayFont, homeTextFont, Palette } from '@/constants/theme';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

type TextFont = 'text' | 'display';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

/**
 * Texte de l'accueil : Montserrat (`display`) pour le prénom et les gros chiffres, Inter (`text`) pour le reste ; Cairo en arabe.
 * `track` = interlettrage en em (0 en arabe : l'espacement casserait la liaison des lettres).
 */
export function HText({
  font = 'text',
  weight = 'regular',
  size = 14,
  track,
  color = Palette.textPrimary,
  style,
  children,
  ...rest
}: TextProps & {
  font?: TextFont;
  weight?: Weight;
  size?: number;
  track?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}) {
  const { language } = useLanguage();
  const family =
    font === 'display'
      ? homeDisplayFont(language, weight === 'medium' ? 'regular' : (weight as 'regular' | 'semibold' | 'bold'))
      : homeTextFont(language, weight === 'bold' ? 'semibold' : (weight as 'regular' | 'medium' | 'semibold'));
  const letterSpacing = track && language !== 'ar' ? track * size : 0;
  return (
    <ThemedText
      {...rest}
      style={[{ fontFamily: family, fontSize: size, lineHeight: Math.round(size * 1.35), color, letterSpacing }, style]}
    >
      {children}
    </ThemedText>
  );
}

/** Micro-libellé : 10 à 11 px, majuscules, interlettrage large. */
export function MicroLabel({
  children,
  color = Palette.textPrimary,
  size = 11,
  track = 0.16,
  style,
  ...rest
}: TextProps & { children: string; color?: string; size?: number; track?: number }) {
  return (
    <HText weight="semibold" size={size} track={track} color={color} style={style} {...rest}>
      {children.toLocaleUpperCase()}
    </HText>
  );
}

/** Flèche de lien : « → » en LTR, « ← » en RTL. */
export function ArrowIcon({ color, size = 15 }: { color: string; size?: number }) {
  const { language } = useLanguage();
  return <Ionicons name={isRTL(language) ? 'arrow-back' : 'arrow-forward'} size={size} color={color} />;
}

/** Lien « libellé → » : libellé graphite (ou blanc sur fond sombre), flèche orange. Zone tactile ≥ 44 px. */
export function ArrowLink({
  label,
  onPress,
  onDark = false,
  size = 13,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  onDark?: boolean;
  size?: number;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <HText weight="semibold" size={size} color={onDark ? Brand.white : Palette.textPrimary}>
        {label}
      </HText>
      <ArrowIcon color={onDark ? Brand.orangeLight : Palette.primary} size={size + 2} />
    </Pressable>
  );
}

/** Flèche diagonale (départ ↗ / retour ↙), retournée en miroir en RTL. */
export function DiagonalArrow({ direction, color }: { direction: 'out' | 'in'; color: string }) {
  const { language } = useLanguage();
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={isRTL(language) ? { transform: [{ scaleX: -1 }] } : undefined}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {direction === 'out' ? (
        <>
          <Path d="M7 17L17 7" />
          <Path d="M8 7h9v9" />
        </>
      ) : (
        <>
          <Path d="M17 7L7 17" />
          <Path d="M16 17H7V8" />
        </>
      )}
    </Svg>
  );
}

/** Bloc gris de chargement (aux dimensions du contenu final). */
export function Skeleton({ width = '100%', height, radius = 18 }: { width?: number | `${number}%`; height: number; radius?: number }) {
  return <View style={{ width, height, borderRadius: radius, backgroundColor: Brand.gaugeTrack }} accessibilityElementsHidden />;
}

/** Montant avec espace des milliers : « 30 500 ». */
export function formatAmount(value: number): string {
  return Math.round(value).toLocaleString('fr-FR');
}

/** Petit écran (≤ 360 dp de large) : les gros chiffres passent de 28 à 24 px plutôt que d'être coupés. */
export function useCompactWidth(): boolean {
  return useWindowDimensions().width <= 360;
}
