import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { mergeDocuments } from '@/features/storage/documents';
import { uploadVehicleDocument, uploadVehiclePhoto } from '@/features/vehicles/api';
import { useCreateVehicle, useUpdateVehicleDocuments, useUpdateVehiclePhotos } from '@/features/vehicles/hooks';
import type { PendingVehicleDocument, VehicleInput } from '@/features/vehicles/types';
import { isDuplicatePlateError } from '@/features/vehicles/validation';
import { VehicleForm } from '@/features/vehicles/vehicle-form';
import { useLanguage } from '@/i18n/use-language';

export default function NouveauVehiculeScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const createVehicle = useCreateVehicle();
  const updateDocuments = useUpdateVehicleDocuments();
  const updatePhotos = useUpdateVehiclePhotos();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    input: VehicleInput,
    pendingDocuments: PendingVehicleDocument[],
    pendingPhotos: string[]
  ) {
    if (!agencyQuery.data) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const vehicle = await createVehicle.mutateAsync({ agencyId: agencyQuery.data.agencyId, input });

      if (pendingDocuments.length > 0) {
        try {
          const uploaded = await Promise.all(
            pendingDocuments.map((doc) =>
              uploadVehicleDocument(agencyQuery.data!.agencyId, vehicle.id, doc.type, doc.localUri, doc.expiresAt)
            )
          );
          await updateDocuments.mutateAsync({
            id: vehicle.id,
            documents: mergeDocuments(vehicle.documents, uploaded),
          });
        } catch {
          Alert.alert(t('common.appName'), t('vehicle.form.uploadError'));
          router.replace(`/flotte/${vehicle.id}`);
          return;
        }
      }

      if (pendingPhotos.length > 0) {
        try {
          const uploaded = await Promise.all(
            pendingPhotos.map((uri) => uploadVehiclePhoto(agencyQuery.data!.agencyId, vehicle.id, uri))
          );
          await updatePhotos.mutateAsync({ id: vehicle.id, photos: [...vehicle.photos, ...uploaded] });
        } catch {
          Alert.alert(t('common.appName'), t('vehicle.form.uploadError'));
          router.replace(`/flotte/${vehicle.id}`);
          return;
        }
      }

      router.replace(`/flotte/${vehicle.id}`);
    } catch (error) {
      setSubmitError(isDuplicatePlateError(error) ? t('vehicle.form.duplicatePlateError') : t('vehicle.form.createError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('vehicle.form.newTitle')} showBack />
        <VehicleForm
          submitLabel={t('vehicle.form.save')}
          submittingLabel={t('vehicle.form.saving')}
          isSubmitting={isSubmitting}
          submitError={submitError}
          onSubmit={handleSubmit}
        />
      </SafeAreaView>
    </ThemedView>
  );
}
