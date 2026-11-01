import { Image, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, M3akPalette } from '@/constants/theme';

const MARK = require('../../assets/images/logo-m3ak-ribbon.png');
const MARK_LIGHT = require('../../assets/images/logo-m3ak-ribbon-light.png');
/** Proportions du fichier (640 × 373). */
const RATIO = 640 / 373;

type LogoProps = {
  size?: 'md' | 'lg';
  /** Pastille seule, sans le nom (en-têtes étroits, menu latéral). */
  markOnly?: boolean;
  /** `light` : nom en blanc, pour un fond mauve profond. */
  tone?: 'dark' | 'light';
};

/**
 * Logo M3ak : ruban en « M », voiture et clés (fichier officiel `assets/images/logo-m3ak-ribbon.png`, fond transparent) + nom.
 * Fond transparent partout. Sur fond sombre (`tone="light"`), on utilise la version éclaircie `logo-m3ak-ribbon-light.png` :
 * les mauves foncés de l'original s'y fondraient.
 */
export function Logo({ size = 'md', markOnly = false, tone = 'dark' }: LogoProps) {
  const height = size === 'lg' ? 96 : 52;
  const wordSize = size === 'lg' ? 40 : 24;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="M3ak"
      className="flex-row items-center"
      style={{ gap: size === 'lg' ? 14 : 10 }}
    >
      <Image
        source={tone === 'light' ? MARK_LIGHT : MARK}
        resizeMode="contain"
        style={{ width: height * RATIO, height }}
      />
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
