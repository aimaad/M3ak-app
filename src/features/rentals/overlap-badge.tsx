import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

/** Pastille d'alerte : cette location chevauche une autre location active de la même voiture. */
export function OverlapBadge() {
  const { t } = useLanguage();
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-[#FEE2E2] px-3 py-1">
      <Ionicons name="warning" size={13} color="#B91C1C" />
      <ThemedText type="small" style={{ color: '#991B1B', fontSize: 12, fontWeight: '700' }}>
        {t('locations.overlap.badge')}
      </ThemedText>
    </View>
  );
}
