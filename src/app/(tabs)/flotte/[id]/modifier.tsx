import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { parseVehicleSection } from '@/features/vehicles/use-section-scroll';
import { useUpdateVehicle, useVehicle } from '@/features/vehicles/hooks';
import type { VehicleInput } from '@/features/vehicles/types';
import { duplicateVehicleField, fromIsoDate } from '@/features/vehicles/validation';
import { VehicleForm } from '@/features/vehicles/vehicle-form';
import type { VehicleFormValues } from '@/features/vehicles/validation';
import { useLanguage } from '@/i18n/use-language';
import { Palette } from '@/constants/theme';

export default function ModifierVehiculeScreen() {
  const { id, section, field } = useLocalSearchParams<{ id: string; section?: string; field?: string }>();
  const { t } = useLanguage();
  const { data: vehicle, isLoading, isError } = useVehicle(id);
  // Anciens liens : les photos et les documents ne sont plus dans ce formulaire, on ouvre directement leur écran.
  const wanted = parseVehicleSection(section);
  const updateVehicle = useUpdateVehicle();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(input: VehicleInput) {
    if (!vehicle) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await updateVehicle.mutateAsync({ id: vehicle.id, input });
      router.back();
    } catch (error) {
      const duplicateField = duplicateVehicleField(error);
      setSubmitError(
        duplicateField === 'vin'
          ? t('vehicle.form.duplicateVinError')
          : duplicateField === 'immatriculation'
            ? t('vehicle.form.duplicatePlateError')
            : t('vehicle.form.updateError')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (wanted === 'photos') return <Redirect href={{ pathname: '/flotte/[id]/photos', params: { id } }} />;
  if (wanted === 'documents') return <Redirect href={{ pathname: '/flotte/[id]', params: { id, edit: 'documents' } }} />;

  const initialValues: VehicleFormValues | undefined = vehicle
    ? {
        marque: vehicle.marque,
        modele: vehicle.modele,
        immatriculation: vehicle.immatriculation,
        vin: vehicle.vin ?? '',
        finition: vehicle.finition ?? '',
        annee: vehicle.annee ? String(vehicle.annee) : '',
        dateMiseEnCirculation: fromIsoDate(vehicle.dateMiseEnCirculation),
        puissanceFiscale: vehicle.puissanceFiscale ? String(vehicle.puissanceFiscale) : '',
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
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('vehicle.form.editTitle')} showBack />
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={Palette.primary} />
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
            vehicleId={vehicle.id}
            scrollToField={typeof field === 'string' ? field : null}
            initialBranchId={vehicle.branchId}
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
