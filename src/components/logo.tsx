import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Brand, BRAND_FONT } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Nom de l'application (texte courant, accessibilité). Dans le logo, le nom s'écrit en minuscules : « bibip ». */
export const BRAND_NAME = 'BIBIP';

/** Cadre du symbole : même `viewBox` que `assets/images/bibip-symbole-gris.svg` et `-blanc.svg` (fichiers sources du logo). */
const VIEW_BOX = '-0.25 -7.3 124 124';

type Tone = 'auto' | 'dark' | 'light';

/** `light` = pour fond sombre (symbole blanc) ; `dark` = pour fond clair (symbole gris) ; `auto` suit le thème. */
function useStroke(tone: Tone): string {
  const scheme = useColorScheme();
  const onDark = tone === 'light' || (tone === 'auto' && (scheme as string) === 'dark');
  return onDark ? Brand.white : Brand.graphite;
}

/**
 * Le symbole « b » + deux ondes sonores orange. Mêmes tracés que les fichiers SVG `bibip-symbole-gris.svg` (fond clair) et
 * `bibip-symbole-blanc.svg` (fond sombre) : seule la couleur du « b » change, les ondes restent orange.
 */
export function BibipSymbol({ size = 52, tone = 'auto' }: { size?: number; tone?: Tone }) {
  const stroke = useStroke(tone);
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX} accessibilityElementsHidden importantForAccessibility="no">
      <Line x1={18} y1={8} x2={18} y2={92} stroke={stroke} strokeWidth={13} strokeLinecap="round" />
      <Circle cx={46} cy={64} r={26} fill="none" stroke={stroke} strokeWidth={13} />
      <Path d="M81.2 34.4 A46 46 0 0 1 81.2 93.6" fill="none" stroke={Brand.orange} strokeWidth={8} strokeLinecap="round" />
      <Path d="M93.5 24.1 A62 62 0 0 1 93.5 103.9" fill="none" stroke={Brand.orange} strokeWidth={8} strokeLinecap="round" />
    </Svg>
  );
}

type LogoProps = {
  /** Taille (hauteur du symbole, en dp). `md` = 52, `lg` = 96. */
  size?: 'md' | 'lg' | number;
  /** Affiche le symbole seul, sans le texte « bibip ». */
  symbolOnly?: boolean;
  /** `light` : pour un fond sombre (blanc) ; `dark` : pour un fond clair (graphite) ; `auto` : selon le thème. */
  tone?: Tone;
  /** Taille du texte « bibip » (par défaut la moitié du symbole). */
  wordSize?: number;
  /** Espace entre le symbole et le texte (par défaut 16 % du symbole). */
  gap?: number;
};

/**
 * Logo BIBIP : le symbole « b » avec ses deux ondes orange, suivi du texte « bibip » en minuscules (Montserrat SemiBold 600),
 * graphite sur fond clair, blanc sur fond sombre. Prop `symbolOnly` pour le symbole seul.
 */
export function Logo({ size = 'md', symbolOnly = false, tone = 'auto', wordSize: wordSizeProp, gap }: LogoProps) {
  const symbol = size === 'lg' ? 96 : size === 'md' ? 52 : size;
  const color = useStroke(tone);
  const wordSize = wordSizeProp ?? Math.round(symbol * 0.5);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={BRAND_NAME}
      className="flex-row items-center"
      style={{ gap: gap ?? Math.round(symbol * 0.16) }}
    >
      <BibipSymbol size={symbol} tone={tone} />
      {symbolOnly ? null : (
        <Text
          allowFontScaling={false}
          style={{ color, fontSize: wordSize, lineHeight: Math.round(wordSize * 1.25), fontFamily: BRAND_FONT, letterSpacing: -0.4 }}
        >
          bibip
        </Text>
      )}
    </View>
  );
}

/** Le symbole seul, pour les en-têtes (compatibilité). `onDark` : symbole blanc. */
export function LogoMark({ height, onDark = false }: { height: number; onDark?: boolean }) {
  return <BibipSymbol size={height} tone={onDark ? 'light' : 'dark'} />;
}
