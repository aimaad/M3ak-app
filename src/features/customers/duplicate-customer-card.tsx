import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { DuplicateMatch } from './duplicates';

/**
 * « Ce client semble déjà enregistré » : montre qui, pourquoi, et laisse l'employé décider — ouvrir la fiche
 * existante, ou continuer l'enregistrement si c'est bien une autre personne. Rien n'est jamais bloqué ni fusionné.
 */
export function DuplicateCustomerCard({ matches }: { matches: DuplicateMatch[] }) {
  const { t } = useLanguage();
  if (matches.length === 0) return null;
  const shown = matches.slice(0, 2);

  return (
    <View className="gap-3 rounded-2xl bg-[#FEF3C7] px-4 py-3">
      <ThemedText type="smallBold" style={{ color: '#B45309' }}>
        {t('customer.duplicate.title')}
      </ThemedText>
      {shown.map(({ customer, reasons }) => (
        <View key={customer.id} className="gap-1 rounded-xl bg-white px-3 py-2">
          <ThemedText type="smallBold">{customer.nomComplet}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {reasons.map((reason) => t(`customer.duplicate.reasons.${reason}`)).join(' · ')}
          </ThemedText>
          <Button
            label={t('customer.duplicate.view')}
            variant="secondary"
            size="sm"
            onPress={() => router.push(`/clients/${customer.id}`)}
          />
        </View>
      ))}
      {matches.length > shown.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('customer.duplicate.more', { count: matches.length - shown.length })}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {t('customer.duplicate.decide')}
      </ThemedText>
    </View>
  );
}
