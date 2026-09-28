import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useUpdateVehicle, useVehicle } from '@/features/vehicles/hooks';
import type { VehicleInput } from '@/features/vehicles/types';
import { VehicleForm } from '@/features/vehicles/vehicle-form';
import type { VehicleFormValues } from '@/features/vehicles/validation';
import { useLanguage } from '@/i18n/use-language';

export default function ModifierVehiculeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: vehicle, isLoading } = useVehicle(id);
  const updateVehicle = useUpdateVehicle();
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleSubmit(input: VehicleInput) {
    if (!id) return;
    setSubmitError(null);
    updateVehicle.mutate(
      { id, input },
      {
        onSuccess: () => router.back(),
        onError: () => setSubmitError(t('vehicle.form.updateError')),
      }
    );
  }

  const initialValues: VehicleFormValues | undefined = vehicle
    ? {
        marque: vehicle.marque,
        modele: vehicle.modele,
        immatriculation: vehicle.immatriculation,
        annee: vehicle.annee ? String(vehicle.annee) : '',
        carburant: vehicle.carburant,
        kilometrage: String(vehicle.kilometrage),
        prixJour: String(vehicle.prixJour),
        statut: vehicle.statut,
      }
    : undefined;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('vehicle.form.editTitle')} showBack />
        {isLoading || !initialValues ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1f5eff" />
          </View>
        ) : !vehicle ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary">
              {t('vehicle.notFound')}
            </ThemedText>
          </View>
        ) : (
          <VehicleForm
            key={vehicle.id}
            initialValues={initialValues}
            submitLabel={t('vehicle.form.save')}
            submittingLabel={t('vehicle.form.saving')}
            isSubmitting={updateVehicle.isPending}
            submitError={submitError}
            onSubmit={handleSubmit}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
