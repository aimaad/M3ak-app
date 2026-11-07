import { Image, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, Brand, Palette } from '@/constants/theme';

/** Logo officiel BIBIP (fichier fourni, jamais recoloré ni redessiné) : voir `scripts/build-brand-assets.py`. */
export const BIBIP_LOGO = require('../../assets/images/logo-bibip.png');
/** Proportions du fichier (640 × 488). */
export const BIBIP_LOGO_RATIO = 640 / 488;
export const BRAND_NAME = 'BIBIP';

type LogoProps = {
  size?: 'md' | 'lg';
  /** Logo seul, sans le nom (en-têtes étroits, menu latéral). */
  markOnly?: boolean;
  /** `light` : pour un fond sombre. Le logo est posé sur une pastille ivoire (il garde ses couleurs) et le nom passe en blanc. */
  tone?: 'dark' | 'light';
};

/**
 * Logo BIBIP + nom. Le logo a ses propres couleurs (verts et accent lime) : sur fond clair il est posé tel quel ; sur fond
 * sombre il est posé sur une pastille ivoire pour rester parfaitement lisible, sans jamais être recoloré.
 */
export function Logo({ size = 'md', markOnly = false, tone = 'dark' }: LogoProps) {
  const height = size === 'lg' ? 96 : 52;
  const wordSize = size === 'lg' ? 38 : 24;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={BRAND_NAME}
      className="flex-row items-center"
      style={{ gap: size === 'lg' ? 14 : 10 }}
    >
      <LogoMark height={height} onDark={tone === 'light'} />
      {markOnly ? null : (
        <ThemedText
          style={{
            color: tone === 'light' ? Brand.white : Brand.graphite,
            fontSize: wordSize,
            lineHeight: wordSize * 1.2,
            fontFamily: fontFamilyFor('fr', 'extrabold'),
            letterSpacing: 1,
          }}
        >
          {BRAND_NAME}
        </ThemedText>
      )}
    </View>
  );
}

/**
 * Le logo seul. `onDark` : pastille ivoire arrondie derrière le logo (hauteur totale = `height`), pour les fonds sombres.
 */
export function LogoMark({ height, onDark = false }: { height: number; onDark?: boolean }) {
  if (!onDark) {
    return (
      <Image
        source={BIBIP_LOGO}
        resizeMode="contain"
        style={{ width: height * BIBIP_LOGO_RATIO, height }}
        accessible={false}
      />
    );
  }
  const padding = Math.round(height * 0.12);
  const inner = height - padding * 2;
  return (
    <View
      style={{
        height,
        width: inner * BIBIP_LOGO_RATIO + padding * 2,
        padding,
        borderRadius: Math.round(height * 0.3),
        backgroundColor: Palette.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image
        source={BIBIP_LOGO}
        resizeMode="contain"
        style={{ width: inner * BIBIP_LOGO_RATIO, height: inner }}
        accessible={false}
      />
    </View>
  );
}
