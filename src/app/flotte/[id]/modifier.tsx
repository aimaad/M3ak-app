import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { mergeDocuments } from '@/features/storage/documents';
import { uploadVehicleDocument, uploadVehiclePhoto } from '@/features/vehicles/api';
import { useUpdateVehicle, useUpdateVehicleDocuments, useUpdateVehiclePhotos, useVehicle } from '@/features/vehicles/hooks';
import type { PendingVehicleDocument, VehicleInput } from '@/features/vehicles/types';
import { isDuplicatePlateError } from '@/features/vehicles/validation';
import { VehicleForm } from '@/features/vehicles/vehicle-form';
import type { VehicleFormValues } from '@/features/vehicles/validation';
import { useLanguage } from '@/i18n/use-language';

export default function ModifierVehiculeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: vehicle, isLoading, isError } = useVehicle(id);
  const updateVehicle = useUpdateVehicle();
  const updateDocuments = useUpdateVehicleDocuments();
  const updatePhotos = useUpdateVehiclePhotos();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    input: VehicleInput,
    pendingDocuments: PendingVehicleDocument[],
    pendingPhotos: string[]
  ) {
    if (!vehicle) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await updateVehicle.mutateAsync({ id: vehicle.id, input });

      if (pendingDocuments.length > 0) {
        try {
          const uploaded = await Promise.all(
            pendingDocuments.map((doc) =>
              uploadVehicleDocument(vehicle.agencyId, vehicle.id, doc.type, doc.localUri, doc.expiresAt)
            )
          );
          await updateDocuments.mutateAsync({
            id: vehicle.id,
            documents: mergeDocuments(vehicle.documents, uploaded),
          });
        } catch {
          Alert.alert(t('common.appName'), t('vehicle.form.uploadError'));
        }
      }

      if (pendingPhotos.length > 0) {
        try {
          const uploaded = await Promise.all(
            pendingPhotos.map((uri) => uploadVehiclePhoto(vehicle.agencyId, vehicle.id, uri))
          );
          await updatePhotos.mutateAsync({ id: vehicle.id, photos: [...vehicle.photos, ...uploaded] });
        } catch {
          Alert.alert(t('common.appName'), t('vehicle.form.uploadError'));
        }
      }

      router.back();
    } catch (error) {
      setSubmitError(isDuplicatePlateError(error) ? t('vehicle.form.duplicatePlateError') : t('vehicle.form.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const initialValues: VehicleFormValues | undefined = vehicle
    ? {
        marque: vehicle.marque,
        modele: vehicle.modele,
        immatriculation: vehicle.immatriculation,
        annee: vehicle.annee ? String(vehicle.annee) : '',
        categorie: vehicle.categorie,
        couleur: vehicle.couleur ?? '',
        nombrePlaces: vehicle.nombrePlaces ? String(vehicle.nombrePlaces) : '',
        transmission: vehicle.transmission,
        carburant: vehicle.carburant,
        kilometrage: String(vehicle.kilometrage),
        niveauCarburant: vehicle.niveauCarburant !== null ? String(vehicle.niveauCarburant) : '',
        prixJour: String(vehicle.prixJour),
        prixSemaine: vehicle.prixSemaine !== null ? String(vehicle.prixSemaine) : '',
        prixMois: vehicle.prixMois !== null ? String(vehicle.prixMois) : '',
        description: vehicle.description ?? '',
        statut: vehicle.statut,
      }
    : undefined;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('vehicle.form.editTitle')} showBack />
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#7C3AED" />
          </View>
        ) : isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('vehicle.loadError')}
            </ThemedText>
          </View>
        ) : !vehicle || !initialValues ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary">
              {t('vehicle.notFound')}
            </ThemedText>
          </View>
        ) : (
          <VehicleForm
            key={vehicle.id}
            initialValues={initialValues}
            existingDocuments={vehicle.documents}
            existingPhotosCount={vehicle.photos.length}
            submitLabel={t('vehicle.form.save')}
            submittingLabel={t('vehicle.form.saving')}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onSubmit={handleSubmit}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
