import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { Pager } from '@/components/pager';
import { RentalStatusBadge } from '@/features/rentals/rental-status-badge';
import { useDesktopLayout } from '@/hooks/use-desktop-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCustomers } from '@/features/customers/hooks';
import type { Customer } from '@/features/customers/types';
import { overlappingRentalIds } from '@/features/rentals/availability';
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
  const isDesktop = useDesktopLayout();
  const fabSideClass = isRTL(language) ? 'left-6' : 'right-6';
  const rentalsQuery = useRentals();
  const vehiclesQuery = useVehicles();
  const customersQuery = useCustomers();
  const [statusFilter, setStatusFilter] = useState<RentalStatusFilter>('tous');

  const rentals = rentalsQuery.data ?? EMPTY_RENTALS;
  const counts = useMemo(() => countRentalsByStatus(rentals), [rentals]);
  const overlapping = useMemo(() => overlappingRentalIds(rentals), [rentals]);
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

  const columns: DataTableColumn<Rental>[] = [
    { key: 'number', label: t('desktop.number'), render: (r) => <ThemedText type="smallBold">{r.numero}</ThemedText> },
    {
      key: 'vehicle',
      label: t('desktop.vehicle'),
      flex: 1.5,
      render: (r) => {
        const v = vehiclesById.get(r.vehicleId);
        return (
          <ThemedText type="small" numberOfLines={1}>
            {v ? `${v.marque} ${v.modele} · ${v.immatriculation}` : t('locations.unknownVehicle')}
          </ThemedText>
        );
      },
    },
    {
      key: 'customer',
      label: t('desktop.customer'),
      flex: 1.5,
      render: (r) => (
        <ThemedText type="small" numberOfLines={1}>
          {customersById.get(r.customerId)?.nomComplet ?? t('locations.unknownCustomer')}
        </ThemedText>
      ),
    },
    {
      key: 'period',
      label: t('desktop.period'),
      flex: 1.5,
      render: (r) => (
        <ThemedText type="small">
          {new Date(r.dateDebutPrevue).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} →{' '}
          {new Date(r.dateFinPrevue).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
        </ThemedText>
      ),
    },
    { key: 'status', label: t('desktop.status'), render: (r) => <RentalStatusBadge status={r.statut} /> },
  ];

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
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

        {/* width 0 + minWidth 100 % : la rangée de pastilles défile sans jamais élargir l'écran (web). */}
        <View className="pb-4" style={{ width: 0, minWidth: '100%' }}>
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
          isDesktop ? (
            <ScrollView contentContainerClassName="px-6 pb-24">
              <DataTable
                columns={columns}
                rows={pagination.items}
                rowKey={(item) => item.id}
                onRowPress={(item) => router.push(`/locations/${item.id}`)}
                exportCsv={{ filename: 'locations', rows: filtered, cells: (r) => [r.numero, vehiclesById.get(r.vehicleId)?.immatriculation, customersById.get(r.customerId)?.nomComplet, r.dateDebutPrevue.slice(0, 10) + ' → ' + r.dateFinPrevue.slice(0, 10), t(`locations.status.${r.statut}`)] }}
                emptyLabel={rentals.length === 0 ? t('locations.emptyNone') : t('locations.empty')}
              />
              <Pager page={pagination.page} pageCount={pagination.pageCount} onChange={pagination.setPage} />
            </ScrollView>
          ) : (
          <FlatList
            data={pagination.items}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 px-6 pb-24"
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
                overlap={overlapping.has(item.id)}
              />
            )}
            ListFooterComponent={<Pager page={pagination.page} pageCount={pagination.pageCount} onChange={pagination.setPage} />}
            ListEmptyComponent={
              <View className="items-center pt-12">
                <ThemedText type="default" themeColor="textSecondary">
                  {rentals.length === 0 ? t('locations.emptyNone') : t('locations.empty')}
                </ThemedText>
              </View>
            }
          />
          )
        )}

        <Pressable
          onPress={() => router.push('/locations/nouveau')}
          className={`absolute bottom-6 ${fabSideClass} flex-row items-center gap-2 rounded-full bg-[#7C3AED] px-5 py-4`}
        >
          <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
            {`+ ${t('locations.addRental')}`}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}
