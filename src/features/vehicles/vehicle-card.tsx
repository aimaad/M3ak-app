import { View } from 'react-native';

import { PressableCard } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { VehicleImage } from './vehicle-image';
import { VehicleStatusBadge } from './vehicle-status-badge';
import type { Vehicle } from './types';

export function VehicleCard({ vehicle, onPress, showPrice = true }: { vehicle: Vehicle; onPress: () => void; /** Le prix par jour n'est montré qu'au propriétaire (l'écran le décide). */ showPrice?: boolean }) {
  const { t } = useLanguage();

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

      <VehicleImage vehicle={vehicle} height={112} radius={16} />

      <View className="flex-row justify-between">
        <View className="gap-0.5">
          <ThemedText type="small" themeColor="textSecondary">
            {t('vehicle.fields.kilometrage')}
          </ThemedText>
          <ThemedText type="smallBold">
            {vehicle.kilometrage.toLocaleString('fr-FR')} {t('flotte.km')}
          </ThemedText>
        </View>
        {showPrice ? (
          <View className="items-end gap-0.5">
            <ThemedText type="small" themeColor="textSecondary">
              {t('vehicle.fields.prixJour')}
            </ThemedText>
            <ThemedText type="smallBold" themeColor="primary">
              {vehicle.prixJour.toLocaleString('fr-FR')} {t('flotte.perDay')}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </PressableCard>
  );
}
