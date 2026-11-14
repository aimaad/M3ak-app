import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/theme';
import { useVehicle } from '@/features/vehicles/hooks';
import { parseVehicleSection } from '@/features/vehicles/use-section-scroll';
import { VehicleForm } from '@/features/vehicles/vehicle-form';
import { useLanguage } from '@/i18n/use-language';

/**
 * « Modifier la fiche technique » : charge le véhicule et ouvre le formulaire, qui a son propre en-tête, sa barre d'enregistrement et sa
 * confirmation de sortie. Anciens liens : les photos et les documents ont leurs écrans.
 */
export default function ModifierVehiculeScreen() {
  const { id, section, field } = useLocalSearchParams<{ id: string; section?: string; field?: string }>();
  const { t } = useLanguage();
  const { data: vehicle, isLoading, isError } = useVehicle(id);
  const wanted = parseVehicleSection(section);

  if (wanted === 'photos') return <Redirect href={{ pathname: '/flotte/[id]/photos', params: { id } }} />;
  if (wanted === 'documents') return <Redirect href={{ pathname: '/flotte/[id]', params: { id, edit: 'documents' } }} />;

  return (
    <ThemedView className="flex-1">
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Palette.primary} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <ThemedText type="default" themeColor="textSecondary" className="text-center">
            {t('vehicleForm.edit.loadError')}
          </ThemedText>
        </View>
      ) : !vehicle ? (
        <View className="flex-1 items-center justify-center px-8">
          <ThemedText type="default" themeColor="textSecondary">
            {t('vehicleForm.edit.notFound')}
          </ThemedText>
        </View>
      ) : (
        <VehicleForm key={vehicle.id} vehicle={vehicle} scrollToField={typeof field === 'string' ? field : null} />
      )}
    </ThemedView>
  );
}
