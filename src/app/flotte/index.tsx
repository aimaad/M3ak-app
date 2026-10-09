import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TextField } from '@/components/text-field';
import { useMyAgency } from '@/features/agency/hooks';
import {
  countByStatus,
  countExpiringSoonDocuments,
  countImmobilized,
  DEFAULT_VEHICLE_FILTERS,
  filterVehicles,
  sortVehicles,
  STATUS_FILTERS,
  uniqueBrands,
  type StatusFilter,
  type VehicleFilters,
  type VehicleSort,
} from '@/features/vehicles/filters';
import { useVehicles } from '@/features/vehicles/hooks';
import { StatusFilterChips } from '@/features/vehicles/status-filter-chips';
import { VehicleCard } from '@/features/vehicles/vehicle-card';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';
import type { Vehicle } from '@/features/vehicles/types';

const EMPTY_VEHICLES: Vehicle[] = [];
const SORT_OPTIONS: VehicleSort[] = ['recent', 'marque', 'immatriculation', 'prixJour', 'kilometrage'];

function KpiTile({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="min-w-[130px] gap-1 rounded-3xl border border-[#e1e5f0] bg-white px-4 py-3"
    >
      <ThemedText type="title" themeColor="primary">
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function FlotteScreen() {
  const { t, language } = useLanguage();
  const fabSideClass = isRTL(language) ? 'left-6' : 'right-6';
  const agencyQuery = useMyAgency();
  const vehiclesQuery = useVehicles();
  const { statut: initialStatut } = useLocalSearchParams<{ statut?: string }>();
  const [filters, setFilters] = useState<VehicleFilters>(() => ({
    ...DEFAULT_VEHICLE_FILTERS,
    statusFilter: STATUS_FILTERS.includes(initialStatut as StatusFilter)
      ? (initialStatut as StatusFilter)
      : 'tous',
  }));
  const [sort, setSort] = useState<VehicleSort>('recent');
  const [showFilters, setShowFilters] = useState(false);

  const vehicles = vehiclesQuery.data ?? EMPTY_VEHICLES;
  const activeVehicles = useMemo(() => vehicles.filter((v) => !v.archivedAt), [vehicles]);
  const counts = useMemo(() => countByStatus(vehicles), [vehicles]);
  const immobilized = useMemo(() => countImmobilized(vehicles), [vehicles]);
  const expiringDocs = useMemo(() => countExpiringSoonDocuments(vehicles), [vehicles]);
  const brands = useMemo(() => uniqueBrands(activeVehicles), [activeVehicles]);
  const filtered = useMemo(
    () => sortVehicles(filterVehicles(vehicles, filters), sort),
    [vehicles, filters, sort]
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
        <ScreenHeader title={t('flotte.title')} subtitle={t('flotte.subtitle', { count: counts.tous })} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-6 pb-3">
          <KpiTile label={t('flotte.kpi.total')} value={counts.tous} />
          <KpiTile
            label={t('flotte.kpi.disponible')}
            value={counts.disponible}
            onPress={() => setFilters((prev) => ({ ...prev, statusFilter: 'disponible', includeArchived: false }))}
          />
          <KpiTile label={t('flotte.kpi.immobilise')} value={immobilized} />
          <KpiTile label={t('flotte.kpi.docsExpirant')} value={expiringDocs} />
        </ScrollView>

        <View className="px-6 pb-3">
          <TextField
            placeholder={t('flotte.searchPlaceholder')}
            value={filters.query}
            onChangeText={(v) => setFilters((prev) => ({ ...prev, query: v }))}
            testID="flotte-search"
          />
        </View>

        <View className="pb-3">
          <StatusFilterChips
            value={filters.statusFilter}
            onChange={(statusFilter) => setFilters((prev) => ({ ...prev, statusFilter }))}
            counts={counts}
          />
        </View>

        <View className="flex-row items-center justify-between px-6 pb-4">
          <Pressable onPress={() => setShowFilters((prev) => !prev)}>
            <ThemedText type="small" themeColor="primary">
              {showFilters ? t('flotte.hideFilters') : t('flotte.moreFilters')}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setFilters((prev) => ({ ...prev, includeArchived: !prev.includeArchived }))}
          >
            <ThemedText type="small" themeColor={filters.includeArchived ? 'primary' : 'textSecondary'}>
              {filters.includeArchived ? t('flotte.showingArchived') : t('flotte.showArchived')}
            </ThemedText>
          </Pressable>
        </View>

        {showFilters ? (
          <View className="gap-3 px-6 pb-4">
            <View className="gap-1.5">
              <ThemedText type="small" themeColor="textSecondary">
                {t('flotte.filterByBrand')}
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                <Pressable
                  onPress={() => setFilters((prev) => ({ ...prev, marque: 'toutes' }))}
                  className={`rounded-full border px-4 py-2 ${
                    filters.marque === 'toutes' ? 'border-[#101423] bg-[#101423]' : 'border-[#e1e5f0] bg-white'
                  }`}
                >
                  <ThemedText type="small" style={{ color: filters.marque === 'toutes' ? '#ffffff' : '#101423' }}>
                    {t('flotte.allBrands')}
                  </ThemedText>
                </Pressable>
                {brands.map((marque) => (
                  <Pressable
                    key={marque}
                    onPress={() => setFilters((prev) => ({ ...prev, marque }))}
                    className={`rounded-full border px-4 py-2 ${
                      filters.marque === marque ? 'border-[#101423] bg-[#101423]' : 'border-[#e1e5f0] bg-white'
                    }`}
                  >
                    <ThemedText type="small" style={{ color: filters.marque === marque ? '#ffffff' : '#101423' }}>
                      {marque}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View className="gap-1.5">
              <ThemedText type="small" themeColor="textSecondary">
                {t('flotte.sortBy')}
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                {SORT_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setSort(option)}
                    className={`rounded-full border px-4 py-2 ${
                      sort === option ? 'border-[#1f5eff] bg-[#1f5eff]' : 'border-[#e1e5f0] bg-white'
                    }`}
                  >
                    <ThemedText type="small" style={{ color: sort === option ? '#ffffff' : '#101423' }}>
                      {t(`flotte.sort.${option}`)}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : null}

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
