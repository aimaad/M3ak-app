import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { useCreatePayment } from './hooks';
import { PAYMENT_METHODS, type PaymentMethod } from './types';
import { M3akPalette } from '@/constants/theme';

export function AddPaymentForm({ agencyId, rentalId }: { agencyId: string; rentalId: string }) {
  const { t } = useLanguage();
  const createPayment = useCreatePayment();
  const [expanded, setExpanded] = useState(false);
  const [montant, setMontant] = useState('');
  const [methode, setMethode] = useState<PaymentMethod>('especes');

  const montantValue = Number(montant);
  const isValid = montant.trim() !== '' && Number.isFinite(montantValue) && montantValue > 0;

  async function handleSubmit() {
    if (!isValid) return;
    await createPayment.mutateAsync({ agencyId, rentalId, input: { montant: montantValue, methode } });
    setMontant('');
    setMethode('especes');
    setExpanded(false);
  }

  if (!expanded) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        className="items-center rounded-2xl border border-line bg-white px-4 py-3"
      >
        <ThemedText type="smallBold" themeColor="primary">
          {`+ ${t('locations.addPayment')}`}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <View className="gap-3 rounded-2xl border border-line bg-white p-4">
      <TextField
        label={t('locations.paymentAmount')}
        value={montant}
        onChangeText={setMontant}
        keyboardType="number-pad"
      />
      <View className="gap-1.5">
        <ThemedText type="small" themeColor="textSecondary">
          {t('locations.paymentMethod')}
        </ThemedText>
        <View className="flex-row flex-wrap gap-2">
          {PAYMENT_METHODS.map((method) => {
            const selected = method === methode;
            return (
              <Pressable
                key={method}
                onPress={() => setMethode(method)}
                className={`rounded-full border px-3 py-1.5 ${
                  selected ? 'border-brand bg-brand' : 'border-line bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: selected ? '#ffffff' : M3akPalette.ink }}>
                  {t(`locations.paymentMethods.${method}`)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Pressable
        onPress={handleSubmit}
        disabled={!isValid || createPayment.isPending}
        className={`flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3 ${
          !isValid || createPayment.isPending ? 'bg-subtle' : 'bg-brand'
        }`}
      >
        {createPayment.isPending ? <ActivityIndicator color="#ffffff" /> : null}
        <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
          {t('locations.addPayment')}
        </ThemedText>
      </Pressable>
    </View>
  );
}
