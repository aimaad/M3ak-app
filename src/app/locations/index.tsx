import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { ScreenHeader } from '@/components/screen-header';
import { Pager } from '@/components/pager';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCustomers } from '@/features/customers/hooks';
import type { Customer } from '@/features/customers/types';
import { countRentalsByStatus, filterRentalsByStatus, type RentalStatusFilter } from '@/features/rentals/filters';
import { useRentals } from '@/features/rentals/hooks';
import { RentalCard } from '@/features/rentals/rental-card';
import { RentalStatusFilterChips } from '@/features/rentals/status-filter-chips';
import type { Rental } from '@/features/rentals/types';
import { useVehicles } from '@/features/vehicles/hooks';
import type { Vehicle } from '@/features/vehicles/types';
import { isRTL } from '@/i18n';
import { usePagination } from '@/lib/pagination';
import { useLanguage } from '@/i18n/use-language';

const EMPTY_RENTALS: Rental[] = [];

export default function LocationsScreen() {
  const { t, language } = useLanguage();
  const fabSideClass = isRTL(language) ? 'left-6' : 'right-6';
  const rentalsQuery = useRentals();
  const vehiclesQuery = useVehicles();
  const customersQuery = useCustomers();
  const [statusFilter, setStatusFilter] = useState<RentalStatusFilter>('tous');

  const rentals = rentalsQuery.data ?? EMPTY_RENTALS;
  const counts = useMemo(() => countRentalsByStatus(rentals), [rentals]);
  const filtered = useMemo(() => filterRentalsByStatus(rentals, statusFilter), [rentals, statusFilter]);
  const pagination = usePagination(filtered, statusFilter);

  const vehiclesById = useMemo(() => {
    const map = new Map<string, Vehicle>();
    for (const vehicle of vehiclesQuery.data ?? []) map.set(vehicle.id, vehicle);
    return map;
  }, [vehiclesQuery.data]);

  const customersById = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const customer of customersQuery.data ?? []) map.set(customer.id, customer);
    return map;
  }, [customersQuery.data]);

  const isLoading = rentalsQuery.isLoading || vehiclesQuery.isLoading || customersQuery.isLoading;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={t('locations.title')}
          subtitle={t('locations.subtitle', { count: rentals.length })}
          right={
            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => router.push('/contrats')} hitSlop={8}>
                <ThemedText type="small" themeColor="primary">
                  {t('contract.listTitle')}
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => router.push('/locations/calendrier')} hitSlop={8}>
                <ThemedText type="small" themeColor="primary">
                  {t('locations.calendar.title')}
                </ThemedText>
              </Pressable>
            </View>
          }
        />

        <View className="pb-4">
          <RentalStatusFilterChips value={statusFilter} onChange={setStatusFilter} counts={counts} />
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#7C3AED" />
            <ThemedText type="small" themeColor="textSecondary" className="mt-2">
              {t('locations.loading')}
            </ThemedText>
          </View>
        ) : rentalsQuery.isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('locations.loadError')}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={pagination.items}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 px-6 pb-32"
            refreshControl={
              <RefreshControl
                refreshing={rentalsQuery.isFetching}
                onRefresh={() => void rentalsQuery.refetch()}
                tintColor="#7C3AED"
              />
            }
            renderItem={({ item }) => (
              <RentalCard
                rental={item}
                vehicle={vehiclesById.get(item.vehicleId)}
                customer={customersById.get(item.customerId)}
                onPress={() => router.push(`/locations/${item.id}`)}
              />
            )}
            ListFooterComponent={<Pager page={pagination.page} pageCount={pagination.pageCount} onChange={pagination.setPage} />}
            ListEmptyComponent={
              <View className="items-center pt-12">
                <ThemedText type="default" themeColor="textSecondary">
                  {t('locations.empty')}
                </ThemedText>
              </View>
            }
          />
        )}

        <Pressable
          onPress={() => router.push('/locations/nouveau')}
          className={`absolute bottom-24 ${fabSideClass} flex-row items-center gap-2 rounded-full bg-[#7C3AED] px-5 py-4`}
        >
          <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
            {`+ ${t('locations.addRental')}`}
          </ThemedText>
        </Pressable>

        <BottomTabBar current="locations" />
      </SafeAreaView>
    </ThemedView>
  );
}
