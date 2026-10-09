import { Image, Pressable, View } from 'react-native';

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
    <Pressable
      onPress={onPress}
      className="gap-3 rounded-3xl border border-[#e1e5f0] bg-white p-4"
    >
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
        <Image source={{ uri: photoUrl }} className="h-28 w-full rounded-2xl" resizeMode="cover" />
      ) : (
        <View className="h-28 items-center justify-center rounded-2xl bg-[#f4f6fb]">
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
    </Pressable>
  );
}
