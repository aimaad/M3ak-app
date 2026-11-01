import { Image, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, M3akPalette } from '@/constants/theme';

const MARK = require('../../assets/images/logo-m3ak-mark.png');

type LogoProps = {
  size?: 'md' | 'lg';
  /** Pastille seule, sans le nom (en-têtes étroits, menu latéral). */
  markOnly?: boolean;
  /** `light` : nom en blanc, pour un fond mauve profond. */
  tone?: 'dark' | 'light';
};

/** Logo M3ak : pastille mauve (fichier officiel `assets/images/logo-m3ak-mark.png`) + nom. */
export function Logo({ size = 'md', markOnly = false, tone = 'dark' }: LogoProps) {
  const height = size === 'lg' ? 72 : 44;
  const wordSize = size === 'lg' ? 40 : 24;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="M3ak" className="flex-row items-center" style={{ gap: size === 'lg' ? 14 : 10 }}>
      <Image source={MARK} resizeMode="contain" style={{ width: height * 1.03, height }} />
      {markOnly ? null : (
        <ThemedText
          style={{
            color: tone === 'light' ? '#FFFFFF' : M3akPalette.mauveDeep,
            fontSize: wordSize,
            lineHeight: wordSize * 1.2,
            fontFamily: fontFamilyFor('fr', 'extrabold'),
            letterSpacing: -0.5,
          }}
        >
          M3ak
        </ThemedText>
      )}
    </View>
  );
}
