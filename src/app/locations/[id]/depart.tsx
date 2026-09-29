import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useStartRental } from '@/features/rentals/hooks';
import { validateOdometerForm } from '@/features/rentals/validation';
import { useVehicle } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

export default function DepartScreen() {
  const { id, vehicleId } = useLocalSearchParams<{ id: string; vehicleId: string }>();
  const { t } = useLanguage();
  const { data: vehicle } = useVehicle(vehicleId);
  const startRental = useStartRental();

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
      await startRental.mutateAsync({
        id,
        vehicleId,
        input: { kmDepart: Number(kilometrage), carburantDepart: Number(carburant) },
      });
      router.back();
    } catch {
      setError(t('locations.depart.error'));
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('locations.depart.title')} showBack />
        <View className="gap-4 px-6">
          <TextField
            label={t('locations.depart.kilometrage')}
            value={kilometrage}
            onChangeText={setKilometrage}
            keyboardType="number-pad"
            error={touched && errors.kilometrage ? t('locations.form.errors.invalid_number') : undefined}
          />
          <TextField
            label={t('locations.depart.carburant')}
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
            disabled={startRental.isPending}
            className={`mt-2 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
              startRental.isPending ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
            }`}
          >
            {startRental.isPending ? <ActivityIndicator color="#ffffff" /> : null}
            <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
              {startRental.isPending ? t('locations.depart.saving') : t('locations.depart.save')}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
