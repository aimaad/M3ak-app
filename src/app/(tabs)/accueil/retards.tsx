import { router } from 'expo-router';
import { useMemo } from 'react';
import { Linking, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useCustomers } from '@/features/customers/hooks';
import { lateDays, lateRentals } from '@/features/dashboard/kpis';
import { useRentals } from '@/features/rentals/hooks';
import { useVehicles } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

import { HomeListScreen } from '@/features/dashboard/home-list-screen';

/** Retours en retard : qui, quelle voiture, depuis combien de jours ; appeler le client ou facturer les jours en plus. */
export default function LateReturnsScreen() {
  const { t } = useLanguage();
  const rentals = useRentals();
  const customers = useCustomers();
  const vehicles = useVehicles();
  const now = new Date();
  const items = useMemo(() => lateRentals(rentals.data ?? [], new Date()), [rentals.data]);

  return (
    <HomeListScreen
      title={t('accueil.home.lists.late.title')}
      data={items}
      loading={rentals.isLoading}
      emptyLabel={t('accueil.home.lists.late.empty')}
      keyOf={(rental) => rental.id}
      renderItem={(rental) => {
        const customer = customers.data?.find((c) => c.id === rental.customerId);
        const vehicle = vehicles.data?.find((v) => v.id === rental.vehicleId);
        return (
          <Card className="gap-3">
            <View className="gap-0.5">
              <ThemedText type="smallBold">{customer?.nomComplet ?? t('locations.unknownCustomer')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {vehicle ? `${vehicle.marque} ${vehicle.modele} · ${vehicle.immatriculation}` : t('locations.unknownVehicle')}
              </ThemedText>
              <ThemedText type="small" themeColor="danger">
                {t('accueil.home.lists.late.by', { count: lateDays(rental, now) })}
              </ThemedText>
            </View>
            <View className="flex-row gap-2">
              <Button
                label={customer?.telephone ? t('accueil.home.lists.late.call') : t('accueil.home.lists.late.noPhone')}
                variant="secondary"
                size="sm"
                icon="call-outline"
                disabled={!customer?.telephone}
                onPress={() => void Linking.openURL(`tel:${customer?.telephone}`)}
                style={{ flex: 1 }}
              />
              <Button
                label={t('accueil.home.lists.late.bill')}
                variant="secondary"
                size="sm"
                onPress={() => router.push({ pathname: '/locations/[id]', params: { id: rental.id } })}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        );
      }}
    />
  );
}
