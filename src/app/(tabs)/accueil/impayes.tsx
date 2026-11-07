import { router } from 'expo-router';
import { useMemo } from 'react';

import { PressableCard } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { View } from 'react-native';
import { useCustomers } from '@/features/customers/hooks';
import { formatAmount } from '@/features/dashboard/home-ui';
import { outstandingRentals } from '@/features/dashboard/kpis';
import { useAllPayments } from '@/features/payments/hooks';
import { useRentals } from '@/features/rentals/hooks';
import { useVehicles } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

import { HomeListScreen } from '@/features/dashboard/home-list-screen';

/** Locations non soldées, le plus gros reste à payer d'abord. */
export default function UnpaidScreen() {
  const { t } = useLanguage();
  const rentals = useRentals();
  const payments = useAllPayments();
  const customers = useCustomers();
  const vehicles = useVehicles();
  const items = useMemo(() => outstandingRentals(rentals.data ?? [], payments.data ?? []), [rentals.data, payments.data]);

  return (
    <HomeListScreen
      title={t('accueil.home.lists.unpaid.title')}
      data={items}
      loading={rentals.isLoading || payments.isLoading}
      emptyLabel={t('accueil.home.lists.unpaid.empty')}
      keyOf={(item) => item.rental.id}
      renderItem={({ rental, balance }) => {
        const customer = customers.data?.find((c) => c.id === rental.customerId);
        const vehicle = vehicles.data?.find((v) => v.id === rental.vehicleId);
        return (
          <PressableCard
            onPress={() => router.push({ pathname: '/locations/[id]', params: { id: rental.id } })}
            className="flex-row items-center justify-between gap-3"
          >
            <View className="flex-1 gap-0.5">
              <ThemedText type="smallBold" numberOfLines={1}>
                {customer?.nomComplet ?? t('locations.unknownCustomer')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {vehicle ? `${vehicle.marque} ${vehicle.modele}` : t('locations.unknownVehicle')}
              </ThemedText>
            </View>
            <ThemedText type="smallBold">{t('accueil.home.lists.unpaid.remaining', { amount: formatAmount(balance) })}</ThemedText>
          </PressableCard>
        );
      }}
    />
  );
}
