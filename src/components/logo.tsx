import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, M3akPalette } from '@/constants/theme';

type LogoProps = {
  size?: 'md' | 'lg';
  /** Pastille seule, sans le nom (en-têtes étroits, menu latéral). */
  markOnly?: boolean;
  /** `light` : nom en blanc, pour un fond vert forêt. */
  tone?: 'dark' | 'light';
};

/**
 * Logo typographique Kriha : pastille émeraude « K » + nom. Provisoire : à remplacer par le fichier du logo officiel
 * (image) quand il sera fourni ; l'icône et l'écran de lancement de l'application sont des fichiers à part.
 */
export function Logo({ size = 'md', markOnly = false, tone = 'dark' }: LogoProps) {
  const box = size === 'lg' ? 72 : 44;
  const wordSize = size === 'lg' ? 40 : 24;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Kriha" className="flex-row items-center" style={{ gap: size === 'lg' ? 14 : 10 }}>
      <View
        className="items-center justify-center"
        style={{ width: box, height: box, borderRadius: box * 0.3, backgroundColor: M3akPalette.emerald }}
      >
        <ThemedText
          style={{ color: M3akPalette.onEmerald, fontSize: box * 0.56, lineHeight: box * 0.7, fontFamily: fontFamilyFor('fr', 'extrabold') }}
        >
          K
        </ThemedText>
      </View>
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
          Kriha
        </ThemedText>
      )}
    </View>
  );
}
