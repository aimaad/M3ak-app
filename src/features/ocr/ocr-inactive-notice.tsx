import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { inactiveMessageKey, type OcrAvailability } from './availability';

/** Message « fonction non active pour votre entreprise » (avec accès aux réglages pour le propriétaire). */
export function OcrInactiveNotice({ availability }: { availability: OcrAvailability }) {
  const { t } = useLanguage();
  if (availability === 'active' || availability === 'loading') return null;
  return (
    <View className="gap-2 rounded-2xl bg-[#FEF3C7] px-4 py-3">
      <ThemedText type="small" style={{ color: '#B45309' }}>
        {t(inactiveMessageKey(availability))}
      </ThemedText>
      {availability === 'owner_can_enable' ? (
        <Button label={t('ocr.inactive.openSettings')} variant="secondary" size="sm" onPress={() => router.push('/entreprise')} />
      ) : null}
    </View>
  );
}
