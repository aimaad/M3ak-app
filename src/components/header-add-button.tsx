import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { Brand, Palette } from '@/constants/theme';

/** Bouton secondaire d'en-tête : « + » graphite dans un cercle de 44 px cerné de `border`. Jamais orange (l'orange est au « + » de la barre). */
export function HeaderAddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: Palette.border,
        backgroundColor: pressed ? Palette.surface : Palette.card,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Ionicons name="add" size={24} color={Brand.graphite} />
    </Pressable>
  );
}
