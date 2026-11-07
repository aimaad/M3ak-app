import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Palette } from '@/constants/theme';

/**
 * Carte : fond blanc et bordure `border`, sans ombre ni dégradé. Appuyable si `onPress`. `highlighted` : bordure et fond
 * teintés orange doux (l'action principale d'une rangée).
 */
export function GlassCard({
  children,
  onPress,
  highlighted = false,
  label,
  className,
}: {
  children: ReactNode;
  onPress?: () => void;
  highlighted?: boolean;
  label?: string;
  className?: string;
}) {
  const content = (
    <View
      className={`overflow-hidden rounded-[22px] ${className ?? ''}`}
      style={{
        borderWidth: 1,
        borderColor: highlighted ? Palette.primary : Palette.border,
        backgroundColor: highlighted ? Palette.primarySoft : Palette.card,
      }}
    >
      {children}
    </View>
  );
  if (!onPress) return <View style={{ borderRadius: 22 }}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [{ borderRadius: 22 }, { opacity: pressed ? 0.85 : 1 }]}
    >
      {content}
    </Pressable>
  );
}
