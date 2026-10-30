import { Image, View } from 'react-native';

import { PressableCard } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useSignedUrl } from '@/features/storage/hooks';
import { useLanguage } from '@/i18n/use-language';

import { VEHICLE_PHOTOS_BUCKET } from './api';
import { VehicleStatusBadge } from './vehicle-status-badge';
import type { Vehicle } from './types';

export function VehicleCard({ vehicle, onPress }: { vehicle: Vehicle; onPress: () => void }) {
  const { t } = useLanguage();
  const firstPhoto = vehicle.photos[0]?.path;
  const { data: photoUrl } = useSignedUrl(VEHICLE_PHOTOS_BUCKET, firstPhoto);

  return (
    <PressableCard onPress={onPress} className="gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-1">
          <ThemedText type="smallBold">
            {vehicle.marque} {vehicle.modele}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {vehicle.immatriculation}
          </ThemedText>
        </View>
        <View className="items-end gap-1">
          <VehicleStatusBadge status={vehicle.statut} />
          {vehicle.archivedAt ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('vehicle.archivedBadge')}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {photoUrl ? (
        // Image en position absolue : sa taille d'origine n'élargit jamais la carte (important sur le web).
        <View className="h-28 w-full overflow-hidden rounded-2xl">
          <Image source={{ uri: photoUrl }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
      ) : (
        <View className="h-28 items-center justify-center rounded-2xl bg-brand-light">
          <ThemedText type="small" themeColor="textSecondary">
            {vehicle.marque} {vehicle.modele}
          </ThemedText>
        </View>
      )}

      <View className="flex-row justify-between">
        <View className="gap-0.5">
          <ThemedText type="small" themeColor="textSecondary">
            {t('vehicle.fields.kilometrage')}
          </ThemedText>
          <ThemedText type="smallBold">
            {vehicle.kilometrage.toLocaleString('fr-FR')} {t('flotte.km')}
          </ThemedText>
        </View>
        <View className="items-end gap-0.5">
          <ThemedText type="small" themeColor="textSecondary">
            {t('vehicle.fields.prixJour')}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="primary">
            {vehicle.prixJour.toLocaleString('fr-FR')} {t('flotte.perDay')}
          </ThemedText>
        </View>
      </View>
    </PressableCard>
  );
}
