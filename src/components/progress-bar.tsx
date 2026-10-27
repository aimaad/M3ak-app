import { View } from 'react-native';

import { M3akPalette } from '@/constants/theme';

/** Barre de chargement : `fraction` de 0 à 1. */
export function ProgressBar({ fraction, color = M3akPalette.mauve }: { fraction: number; color?: string }) {
  const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} className="h-3 w-full overflow-hidden rounded-full bg-[#E4DCF5]">
      <View style={{ width: `${percent}%`, backgroundColor: color, height: '100%', borderRadius: 999 }} />
    </View>
  );
}
