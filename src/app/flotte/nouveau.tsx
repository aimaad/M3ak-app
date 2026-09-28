import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { useCreateVehicle } from '@/features/vehicles/hooks';
import { VehicleForm } from '@/features/vehicles/vehicle-form';
import type { VehicleInput } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

export default function NouveauVehiculeScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const createVehicle = useCreateVehicle();
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleSubmit(input: VehicleInput) {
    if (!agencyQuery.data) return;
    setSubmitError(null);
    createVehicle.mutate(
      { agencyId: agencyQuery.data.agencyId, input },
      {
        onSuccess: (vehicle) => router.replace(`/flotte/${vehicle.id}`),
        onError: () => setSubmitError(t('vehicle.form.createError')),
      }
    );
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('vehicle.form.newTitle')} showBack />
        <VehicleForm
          submitLabel={t('vehicle.form.save')}
          submittingLabel={t('vehicle.form.saving')}
          isSubmitting={createVehicle.isPending}
          submitError={submitError}
          onSubmit={handleSubmit}
        />
      </SafeAreaView>
    </ThemedView>
  );
}
