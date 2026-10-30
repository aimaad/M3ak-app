import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { fontFamilyFor, Fonts, M3akPalette, ThemeColor, type FontWeightName } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';
import { useTheme } from '@/hooks/use-theme';
import { normalizeText } from '@/lib/normalize-text';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, children, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const { language } = useLanguage();
  const weight = WEIGHT_BY_TYPE[type];

  return (
    <Text
      style={[
        // flexShrink : dans une ligne, un texte long passe à la ligne au lieu de déborder sur son voisin (React Native ne réduit pas par défaut).
        { color: theme[themeColor ?? 'text'], flexShrink: 1 },
        weight ? { fontFamily: fontFamilyFor(language, weight) } : null,
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    >
      {normalizeText(children)}
    </Text>
  );
}

/** Une graisse par type de texte (les polices Kriha n'ont qu'un fichier par graisse). */
const WEIGHT_BY_TYPE: Record<NonNullable<ThemedTextProps['type']>, FontWeightName | null> = {
  default: 'medium',
  small: 'medium',
  smallBold: 'bold',
  title: 'extrabold',
  subtitle: 'bold',
  link: 'medium',
  linkPrimary: 'medium',
  code: null,
};

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontSize: 34,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 28,
    lineHeight: 38,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: M3akPalette.mauve,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
