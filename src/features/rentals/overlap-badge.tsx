import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';
import { Palette } from '@/constants/theme';

/** Pastille d'alerte : cette location chevauche une autre location active de la même voiture. */
export function OverlapBadge() {
  const { t } = useLanguage();
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-error-soft px-3 py-1">
      <Ionicons name="warning" size={13} color={Palette.error} />
      <ThemedText type="small" style={{ color: Palette.error, fontSize: 12, fontWeight: '700' }}>
        {t('locations.overlap.badge')}
      </ThemedText>
    </View>
  );
}
