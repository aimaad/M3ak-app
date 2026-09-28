import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { VehicleStatusBadge } from './vehicle-status-badge';
import type { Vehicle } from './types';

export function VehicleCard({ vehicle, onPress }: { vehicle: Vehicle; onPress: () => void }) {
  const { t } = useLanguage();

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
        <VehicleStatusBadge status={vehicle.statut} />
      </View>

      <View className="h-28 items-center justify-center rounded-2xl bg-[#f4f6fb]">
        <ThemedText type="small" themeColor="textSecondary">
          {vehicle.marque} {vehicle.modele}
        </ThemedText>
      </View>

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
