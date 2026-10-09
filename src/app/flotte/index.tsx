import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TextField } from '@/components/text-field';
import { signOut } from '@/features/auth/api';
import { useMyAgency } from '@/features/agency/hooks';
import {
  countByStatus,
  filterVehicles,
  STATUS_FILTERS,
  type StatusFilter,
} from '@/features/vehicles/filters';
import { useVehicles } from '@/features/vehicles/hooks';
import { StatusFilterChips } from '@/features/vehicles/status-filter-chips';
import { VehicleCard } from '@/features/vehicles/vehicle-card';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';
import type { Vehicle } from '@/features/vehicles/types';

const EMPTY_VEHICLES: Vehicle[] = [];

export default function FlotteScreen() {
  const { t, language } = useLanguage();
  const fabSideClass = isRTL(language) ? 'left-6' : 'right-6';
  const agencyQuery = useMyAgency();
  const vehiclesQuery = useVehicles();
  const { statut: initialStatut } = useLocalSearchParams<{ statut?: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    STATUS_FILTERS.includes(initialStatut as StatusFilter) ? (initialStatut as StatusFilter) : 'tous'
  );

  const vehicles = vehiclesQuery.data ?? EMPTY_VEHICLES;
  const counts = useMemo(() => countByStatus(vehicles), [vehicles]);
  const filtered = useMemo(
    () => filterVehicles(vehicles, statusFilter, search),
    [vehicles, statusFilter, search]
  );

  if (agencyQuery.isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator color="#1f5eff" />
        <ThemedText type="small" themeColor="textSecondary" className="mt-2">
          {t('agency.loading')}
        </ThemedText>
      </ThemedView>
    );
  }

  if (!agencyQuery.data) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={t('flotte.title')}
          subtitle={t('flotte.subtitle', { count: vehicles.length })}
          right={
            <Pressable onPress={() => signOut()} hitSlop={8}>
              <ThemedText type="small" themeColor="primary">
                {t('auth.signOut')}
              </ThemedText>
            </Pressable>
          }
        />

        <View className="px-6 pb-4">
          <TextField
            placeholder={t('flotte.searchPlaceholder')}
            value={search}
            onChangeText={setSearch}
            testID="flotte-search"
          />
        </View>

        <View className="pb-4">
          <StatusFilterChips value={statusFilter} onChange={setStatusFilter} counts={counts} />
        </View>

        {vehiclesQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1f5eff" />
            <ThemedText type="small" themeColor="textSecondary" className="mt-2">
              {t('flotte.loading')}
            </ThemedText>
          </View>
        ) : vehiclesQuery.isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('flotte.loadError')}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 px-6 pb-32"
            refreshControl={
              <RefreshControl
                refreshing={vehiclesQuery.isFetching}
                onRefresh={() => vehiclesQuery.refetch()}
                tintColor="#1f5eff"
              />
            }
            renderItem={({ item }) => (
              <VehicleCard vehicle={item} onPress={() => router.push(`/flotte/${item.id}`)} />
            )}
            ListEmptyComponent={
              <View className="items-center pt-12">
                <ThemedText type="default" themeColor="textSecondary">
                  {t('flotte.empty')}
                </ThemedText>
              </View>
            }
          />
        )}

        <Pressable
          onPress={() => router.push('/flotte/nouveau')}
          className={`absolute bottom-24 ${fabSideClass} flex-row items-center gap-2 rounded-full bg-[#1f5eff] px-5 py-4`}
        >
          <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
            {`+ ${t('flotte.addVehicle')}`}
          </ThemedText>
        </Pressable>

        <BottomTabBar current="flotte" />
      </SafeAreaView>
    </ThemedView>
  );
}
