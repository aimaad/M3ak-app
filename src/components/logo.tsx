import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { M3akPalette } from '@/constants/theme';

type LogoProps = {
  /** « mauve » : tuile violette + nom foncé (fonds clairs) ; « white » : marque et nom blancs (fonds colorés). */
  variant?: 'mauve' | 'white';
  size?: 'md' | 'lg';
  /** Marque seule, sans le nom. */
  markOnly?: boolean;
};

// Formes identiques à assets/brand/*.svg (viewBox 1024) : un « M » géométrique et une étincelle.
const M_PATH = 'M 282 742 L 282 340 L 512 612 L 742 340 L 742 742';
const STAR = 'M 772 200 Q 794 274 868 296 Q 794 318 772 392 Q 750 318 676 296 Q 750 274 772 200 Z';
const SMALL_STAR = 'M 838 374 Q 845 401 872 408 Q 845 415 838 442 Q 831 415 804 408 Q 831 401 838 374 Z';

/** Marque M3ak : « M » blanc sur tuile violette dégradée avec étincelle jaune, ou « M » violet seul sur fond clair. */
export function LogoMark({ size = 48, tile = true }: { size?: number; tile?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="M3ak">
      <Defs>
        <LinearGradient id="m3akBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A472FF" />
          <Stop offset="0.55" stopColor="#7C3AED" />
          <Stop offset="1" stopColor="#4C1D95" />
        </LinearGradient>
      </Defs>
      {tile ? <Rect width="1024" height="1024" rx="232" fill="url(#m3akBg)" /> : null}
      <Path d={M_PATH} fill="none" stroke={tile ? '#FFFFFF' : M3akPalette.mauve} strokeWidth={112} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={STAR} fill="#FFD43B" stroke={tile ? '#FFFFFF' : M3akPalette.mauve} strokeWidth={tile ? 10 : 0} strokeLinejoin="round" />
      <Path d={SMALL_STAR} fill="#FFD43B" />
    </Svg>
  );
}

export function Logo({ variant = 'mauve', size = 'md', markOnly = false }: LogoProps) {
  const white = variant === 'white';
  const markSize = size === 'lg' ? 64 : 36;
  const nameSize = size === 'lg' ? 40 : 24;
  const arabicSize = size === 'lg' ? 18 : 12;

  return (
    <View className="flex-row items-center gap-3">
      <LogoMark size={markSize} tile={!white} />
      {markOnly ? null : (
        <View>
          <Text
            style={{ fontFamily: 'Cairo_700Bold', fontSize: nameSize, lineHeight: nameSize * 1.1, color: white ? '#FFFFFF' : M3akPalette.ink }}
          >
            M3ak
          </Text>
          <Text
            style={{ fontFamily: 'Cairo_600SemiBold', fontSize: arabicSize, lineHeight: arabicSize * 1.3, color: white ? 'rgba(255,255,255,0.85)' : M3akPalette.mauve }}
          >
            معاك
          </Text>
        </View>
      )}
    </View>
  );
}
