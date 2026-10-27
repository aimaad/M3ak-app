import { View } from 'react-native';

import { PressableCard } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import type { Customer } from '@/features/customers/types';
import type { Vehicle } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

import { OverlapBadge } from './overlap-badge';
import { RentalStatusBadge } from './rental-status-badge';
import type { Rental } from './types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function RentalCard({
  rental,
  vehicle,
  customer,
  onPress,
  overlap = false,
}: {
  rental: Rental;
  vehicle: Vehicle | undefined;
  customer: Customer | undefined;
  onPress: () => void;
  /** Chevauche une autre location active de la même voiture. */
  overlap?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <PressableCard onPress={onPress} className="gap-2">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-1">
          <ThemedText type="smallBold">
            {vehicle ? `${vehicle.marque} ${vehicle.modele}` : t('locations.unknownVehicle')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {rental.numero} · {customer?.nomComplet ?? t('locations.unknownCustomer')}
          </ThemedText>
        </View>
        <RentalStatusBadge status={rental.statut} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {formatDate(rental.dateDebutPrevue)} → {formatDate(rental.dateFinPrevue)}
      </ThemedText>
      {overlap ? <OverlapBadge /> : null}
    </PressableCard>
  );
}
