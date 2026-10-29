import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { useResolveDeposit } from './hooks';
import { resolveDeposit } from './resolution';
import type { Deposit } from './types';

export function DepositResolveForm({ deposit }: { deposit: Deposit }) {
  const { t } = useLanguage();
  const resolve = useResolveDeposit();
  const [montantRetenu, setMontantRetenu] = useState('0');

  const resolution = resolveDeposit(deposit.montantBloque, Number(montantRetenu) || 0);

  async function handleSubmit() {
    await resolve.mutateAsync({ id: deposit.id, values: resolution });
  }

  return (
    <View className="gap-3 rounded-2xl border border-line bg-white p-4">
      <TextField
        label={t('locations.cautionResolveLabel')}
        value={montantRetenu}
        onChangeText={setMontantRetenu}
        keyboardType="number-pad"
      />
      <ThemedText type="small" themeColor="textSecondary">
        {`${t('locations.cautionReturned')} : ${resolution.montantRestitue.toLocaleString('fr-FR')} MAD`}
      </ThemedText>
      <Pressable
        onPress={handleSubmit}
        disabled={resolve.isPending}
        className={`flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3 ${
          resolve.isPending ? 'bg-subtle' : 'bg-brand'
        }`}
      >
        {resolve.isPending ? <ActivityIndicator color="#ffffff" /> : null}
        <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
          {t('locations.cautionResolveAction')}
        </ThemedText>
      </Pressable>
    </View>
  );
}
