import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCompleteRental } from '@/features/rentals/hooks';
import { validateOdometerForm } from '@/features/rentals/validation';
import { useVehicle } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

export default function RetourScreen() {
  const { id, vehicleId } = useLocalSearchParams<{ id: string; vehicleId: string }>();
  const { t } = useLanguage();
  const { data: vehicle } = useVehicle(vehicleId);
  const completeRental = useCompleteRental();

  const [kilometrage, setKilometrage] = useState(vehicle ? String(vehicle.kilometrage) : '');
  const [carburant, setCarburant] = useState('100');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = validateOdometerForm({ kilometrage, carburant }, vehicle?.kilometrage ?? 0);

  async function handleSubmit() {
    setTouched(true);
    setError(null);
    if (Object.keys(errors).length > 0 || !id || !vehicleId) return;

    try {
      await completeRental.mutateAsync({
        id,
        vehicleId,
        input: { kmRetour: Number(kilometrage), carburantRetour: Number(carburant) },
      });
      router.back();
    } catch {
      setError(t('locations.retour.error'));
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('locations.retour.title')} showBack />
        <View className="gap-4 px-6">
          <TextField
            label={t('locations.retour.kilometrage')}
            value={kilometrage}
            onChangeText={setKilometrage}
            keyboardType="number-pad"
            error={touched && errors.kilometrage ? t('locations.form.errors.invalid_number') : undefined}
          />
          <TextField
            label={t('locations.retour.carburant')}
            value={carburant}
            onChangeText={setCarburant}
            keyboardType="number-pad"
            error={touched && errors.carburant ? t('locations.form.errors.invalid_number') : undefined}
          />

          {error ? (
            <ThemedText type="small" style={{ color: '#dc2626' }}>
              {error}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={completeRental.isPending}
            className={`mt-2 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
              completeRental.isPending ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
            }`}
          >
            {completeRental.isPending ? <ActivityIndicator color="#ffffff" /> : null}
            <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
              {completeRental.isPending ? t('locations.retour.saving') : t('locations.retour.save')}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
