import { View } from 'react-native';

import { PressableCard } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { Customer } from './types';

export function CustomerCard({ customer, onPress }: { customer: Customer; onPress: () => void }) {
  const { t } = useLanguage();

  return (
    <PressableCard onPress={onPress} className="gap-2">
      <View className="flex-row items-start justify-between gap-2">
        <ThemedText type="smallBold" className="flex-1">
          {customer.nomComplet}
        </ThemedText>
        <View className="items-end gap-1">
          <View className="rounded-full bg-brand-light px-2.5 py-1">
            <ThemedText type="small" themeColor="primary">
              {t(`customer.type.${customer.typeClient}`)}
            </ThemedText>
          </View>
          {customer.archivedAt ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('customer.archivedBadge')}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        {customer.telephone ? (
          <ThemedText type="small" themeColor="textSecondary">
            {customer.telephone}
          </ThemedText>
        ) : null}
        {customer.email ? (
          <ThemedText type="small" themeColor="textSecondary">
            {customer.email}
          </ThemedText>
        ) : null}
        {customer.cinOuPasseport ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('customer.fields.cin')} : {customer.cinOuPasseport}
          </ThemedText>
        ) : null}
      </View>
    </PressableCard>
  );
}
