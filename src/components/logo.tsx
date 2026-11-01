import { Image, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, M3akPalette } from '@/constants/theme';

const MARK = require('../../assets/images/logo-m3ak-ribbon.png');
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
 * Sur fond sombre (`tone="light"`), le logo est posé sur une pastille blanche : ses mauves foncés s'y lisent.
 */
export function Logo({ size = 'md', markOnly = false, tone = 'dark' }: LogoProps) {
  const height = size === 'lg' ? 72 : 44;
  const wordSize = size === 'lg' ? 40 : 24;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="M3ak" className="flex-row items-center" style={{ gap: size === 'lg' ? 14 : 10 }}>
      {tone === 'light' ? (
        <View
          className="items-center justify-center"
          style={{ height, width: height * 1.35, borderRadius: height * 0.28, backgroundColor: 'rgba(255,255,255,0.96)', padding: height * 0.1 }}
        >
          <Image source={MARK} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
        </View>
      ) : (
        <Image source={MARK} resizeMode="contain" style={{ width: height * RATIO, height }} />
      )}
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
