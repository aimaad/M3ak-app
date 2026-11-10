import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { Pager } from '@/components/pager';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { useDesktopLayout } from '@/hooks/use-desktop-layout';
import { VehicleStatusBadge } from '@/features/vehicles/vehicle-status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { useCustomers } from '@/features/customers/hooks';
import { useMaintenanceItems } from '@/features/maintenance/hooks';
import { useRentals } from '@/features/rentals/hooks';
import { AdviceCard } from '@/features/vehicles/advice-card';
import { adviceCandidates, pickAdvice } from '@/features/vehicles/fleet-advice';
import { actionFor, canAddVehiclePhoto, canSeePrices, contextOf, type FleetAction } from '@/features/vehicles/fleet-card';
import { FleetVehicleCard } from '@/features/vehicles/fleet-vehicle-card';
import { FleetLegend, FleetMessage, FleetSectionHeader, FleetSkeleton } from '@/features/vehicles/fleet-sections';
import { buildFleetItems, buildSections, groupCounts, groupFromStatusParam, matchesGroup, toggleGroup, type FleetGroup } from '@/features/vehicles/fleet-model';
import { FleetHeader } from '@/features/vehicles/fleet-header';
import { buildWatchItems } from '@/features/vehicles/fleet-watch';
import { FleetWatchSection } from '@/features/vehicles/fleet-watch-section';
import { inspectionHref } from '@/features/vehicles/fleet-routes';
import { DEFAULT_VEHICLE_FILTERS, filterVehicles, sortVehicles, uniqueBrands, type VehicleFilters, type VehicleSort } from '@/features/vehicles/filters';
import { useVehicles } from '@/features/vehicles/hooks';
import { OfferSheet } from '@/features/vehicles/offer-sheet';
import { useAdviceSnooze } from '@/features/vehicles/use-advice-snooze';
import { VehicleCard } from '@/features/vehicles/vehicle-card';
import { usePagination } from '@/lib/pagination';
import { useLanguage } from '@/i18n/use-language';
import type { Customer } from '@/features/customers/types';
import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';
import type { Vehicle } from '@/features/vehicles/types';
import { Palette, Brand } from '@/constants/theme';

const EMPTY_VEHICLES: Vehicle[] = [];
const EMPTY_RENTALS: Rental[] = [];
const EMPTY_MAINTENANCE: MaintenanceItem[] = [];
const EMPTY_CUSTOMERS: Customer[] = [];
const SORT_OPTIONS: VehicleSort[] = ['recent', 'marque', 'immatriculation', 'prixJour', 'kilometrage'];

export default function FlotteScreen() {
  const { t } = useLanguage();
  const isDesktop = useDesktopLayout();
  const tabInset = useTabBarInset();
  const agencyQuery = useMyAgency();
  const vehiclesQuery = useVehicles();
  const rentalsQuery = useRentals();
  const maintenanceQuery = useMaintenanceItems();
  const customersQuery = useCustomers();
  const { statut: initialStatut } = useLocalSearchParams<{ statut?: string }>();
  const [filters, setFilters] = useState<VehicleFilters>(DEFAULT_VEHICLE_FILTERS);
  // Groupe actif (tuiles de l'en-tête) : un lien de l'accueil (?statut=…) ouvre le groupe correspondant.
  const [group, setGroup] = useState<FleetGroup | null>(() => groupFromStatusParam(initialStatut));
  const [sort, setSort] = useState<VehicleSort>('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [offerVehicleId, setOfferVehicleId] = useState<string | null>(null);
  const { snoozed, loaded: snoozeLoaded, snooze } = useAdviceSnooze();

  const vehicles = vehiclesQuery.data ?? EMPTY_VEHICLES;
  const rentals = rentalsQuery.data ?? EMPTY_RENTALS;
  const maintenance = maintenanceQuery.data ?? EMPTY_MAINTENANCE;
  const role = agencyQuery.data?.role;
  const isOwner = role === 'owner';
  const showPrice = canSeePrices(role);
  const customers = customersQuery.data ?? EMPTY_CUSTOMERS;
  const activeVehicles = useMemo(() => vehicles.filter((v) => !v.archivedAt), [vehicles]);
  // Statut d'aujourd'hui et frise de chaque véhicule : UN calcul pour toute la flotte, même source que les Disponibilités de l'accueil.
  const items = useMemo(() => buildFleetItems({ vehicles, rentals, maintenance, now: new Date() }), [vehicles, rentals, maintenance]);
  const counts = useMemo(() => groupCounts(items), [items]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.vehicle.id, item])), [items]);
  const brands = useMemo(() => uniqueBrands(activeVehicles), [activeVehicles]);
  const filtered = useMemo(() => {
    const base = sortVehicles(filterVehicles(vehicles, filters), sort);
    return filters.includeArchived || group === null ? base : base.filter((v) => itemById.get(v.id)?.group === group);
  }, [vehicles, filters, sort, group, itemById]);
  const pagination = usePagination(filtered, `${JSON.stringify(filters)}${sort}${group}`);

  // Liste groupée par statut : mêmes filtres (recherche, catégorie, marque) et tuile active ; l'ordre dans une section suit le tri choisi.
  const sections = useMemo(() => {
    if (filters.includeArchived) return [];
    const visible = new Set(filtered.map((v) => v.id));
    const order = new Map(filtered.map((v, index) => [v.id, index]));
    const shown = items.filter((item) => visible.has(item.vehicle.id) && matchesGroup(item, group));
    return buildSections(shown).map((section) => ({ key: section.key, data: [...section.items].sort((a, b) => (order.get(a.vehicle.id) ?? 0) - (order.get(b.vehicle.id) ?? 0)) }));
  }, [items, filtered, group, filters.includeArchived]);
  // Données des cartes (client, retour, locations) : une seule préparation pour toute la flotte.
  const cardData = useMemo(
    () => ({ customers: new Map(customers.map((c) => [c.id, c])), rentals: new Map(rentals.map((r) => [r.id, r])), maintenance }),
    [customers, rentals, maintenance]
  );

  // Conseil BIBIP : propriétaire seulement, un seul à la fois, « Plus tard » le masque 24 h.
  const advice = useMemo(
    () => (isOwner && snoozeLoaded ? pickAdvice(adviceCandidates({ items, rentals, now: new Date() }), snoozed, new Date()) : null),
    [isOwner, snoozeLoaded, items, rentals, snoozed]
  );
  // « À surveiller » : documents et entretiens à échéance, un seul calcul pour toute la flotte.
  const watchItems = useMemo(() => buildWatchItems({ vehicles, maintenance, now: new Date() }), [vehicles, maintenance]);
  const offerVehicle = offerVehicleId ? vehicles.find((v) => v.id === offerVehicleId) : undefined;

  if (agencyQuery.isPending) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator color={Palette.primary} />
        <ThemedText type="small" themeColor="textSecondary" className="mt-2">
          {t('agency.loading')}
        </ThemedText>
      </ThemedView>
    );
  }

  if (!agencyQuery.data) {
    return <Redirect href="/onboarding" />;
  }

  const columns: DataTableColumn<Vehicle>[] = [
    {
      key: 'vehicle',
      label: t('desktop.vehicle'),
      flex: 2,
      render: (v) => (
        <ThemedText type="smallBold" numberOfLines={1}>
          {v.marque} {v.modele}
        </ThemedText>
      ),
    },
    { key: 'plate', label: t('desktop.plate'), render: (v) => <ThemedText type="small">{v.immatriculation}</ThemedText> },
    { key: 'year', label: t('desktop.year'), render: (v) => <ThemedText type="small">{v.annee ?? '—'}</ThemedText> },
    { key: 'status', label: t('desktop.status'), render: (v) => <VehicleStatusBadge status={v.statut} /> },
    {
      key: 'km',
      label: t('desktop.mileage'),
      render: (v) => (
        <ThemedText type="small">
          {v.kilometrage.toLocaleString('fr-FR')} {t('flotte.km')}
        </ThemedText>
      ),
    },
  ];
  if (showPrice) columns.push({ key: 'price', label: t('desktop.dailyPrice'), align: 'end', render: (v) => <ThemedText type="smallBold">{v.prixJour} MAD</ThemedText> });

  const agencyName = agencyQuery.data.agencyName;

  const header = (
    <FleetHeader
      agencyName={agencyName}
      counts={counts}
      group={group}
      onToggleGroup={(tapped) => setGroup((current) => toggleGroup(current, tapped))}
      query={filters.query}
      onQueryChange={(query) => setFilters((prev) => ({ ...prev, query }))}
      onOpenFilters={() => setShowFilters((prev) => !prev)}
      onAdd={() => router.push('/flotte/nouveau')}
    >
      {advice ? (
        <AdviceCard
          advice={advice}
          onLater={() => snooze(advice.key)}
          onAct={() => (advice.kind === 'noBooking' ? setOfferVehicleId(advice.vehicleId) : router.push(inspectionHref(advice.vehicleId, rentals) as Parameters<typeof router.push>[0]))}
        />
      ) : null}
    </FleetHeader>
  );

  const watch = <FleetWatchSection items={watchItems} onOpen={(item) => router.push({ pathname: '/flotte/[id]', params: { id: item.vehicleId, section: item.target } })} />;

  const controls = (
    <View>
      <View className="flex-row items-center justify-between px-6 pb-4 pt-4">
        <Pressable onPress={() => setShowFilters((prev) => !prev)}>
          <ThemedText type="small" themeColor="primary">
            {showFilters ? t('flotte.hideFilters') : t('flotte.moreFilters')}
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => setFilters((prev) => ({ ...prev, includeArchived: !prev.includeArchived }))}>
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
            <ScrollView horizontal className="grow-0 shrink-0" showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              <Pressable
                onPress={() => setFilters((prev) => ({ ...prev, marque: 'toutes' }))}
                className={`rounded-full border px-4 py-2 ${filters.marque === 'toutes' ? 'border-graphite bg-graphite' : 'border-border bg-card'}`}
              >
                <ThemedText type="small" style={{ color: filters.marque === 'toutes' ? Brand.white : Palette.textPrimary }}>
                  {t('flotte.allBrands')}
                </ThemedText>
              </Pressable>
              {brands.map((marque) => (
                <Pressable
                  key={marque}
                  onPress={() => setFilters((prev) => ({ ...prev, marque }))}
                  className={`rounded-full border px-4 py-2 ${filters.marque === marque ? 'border-graphite bg-graphite' : 'border-border bg-card'}`}
                >
                  <ThemedText type="small" style={{ color: filters.marque === marque ? Brand.white : Palette.textPrimary }}>
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
            <ScrollView horizontal className="grow-0 shrink-0" showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {SORT_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setSort(option)}
                  className={`rounded-full border px-4 py-2 ${sort === option ? 'border-graphite bg-graphite' : 'border-border bg-card'}`}
                >
                  <ThemedText type="small" style={{ color: sort === option ? Brand.white : Palette.textPrimary }}>
                    {t(`flotte.sort.${option}`)}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );

  const refetchAll = () => {
    void vehiclesQuery.refetch();
    void rentalsQuery.refetch();
    void maintenanceQuery.refetch();
    void customersQuery.refetch();
  };
  const runAction = (action: FleetAction) => router.push(action.href as Parameters<typeof router.push>[0]);
  const archivedMode = filters.includeArchived;
  const noVehicle = vehicles.length === 0;

  return (
    <ThemedView className="flex-1" style={{ backgroundColor: Palette.surface }}>
      <StatusBar style="light" />
      <SafeAreaView className="w-full flex-1" edges={['left', 'right']}>
        {vehiclesQuery.isLoading ? (
          <ScrollView contentContainerStyle={{ paddingBottom: tabInset }}>
            {header}
            <FleetSkeleton />
          </ScrollView>
        ) : vehiclesQuery.isError ? (
          <ScrollView contentContainerStyle={{ paddingBottom: tabInset }}>
            {header}
            <FleetMessage title={t('flotte.loadError')} actionLabel={t('flotte.card.states.retry')} onAction={refetchAll} />
          </ScrollView>
        ) : isDesktop ? (
          <ScrollView contentContainerStyle={{ paddingBottom: tabInset + 24 }}>
            {header}
            {watch}
            {controls}
            <View className="px-6">
              <DataTable
                columns={columns}
                rows={pagination.items}
                rowKey={(item) => item.id}
                onRowPress={(item) => router.push(`/flotte/${item.id}`)}
                exportCsv={{ filename: 'flotte', rows: filtered, cells: (v) => [`${v.marque} ${v.modele}`, v.immatriculation, v.annee, t(`flotte.status.${v.statut}`), v.kilometrage, ...(showPrice ? [v.prixJour] : [])] }}
                emptyLabel={noVehicle ? t('flotte.emptyNone') : t('flotte.empty')}
              />
              <Pager page={pagination.page} pageCount={pagination.pageCount} onChange={pagination.setPage} />
            </View>
          </ScrollView>
        ) : archivedMode ? (
          // Véhicules archivés : liste simple (pas de statut du jour ni de frise : ils ne sont plus dans la flotte).
          <ScrollView contentContainerStyle={{ paddingBottom: tabInset }} refreshControl={<RefreshControl refreshing={vehiclesQuery.isFetching} onRefresh={refetchAll} tintColor={Palette.primary} />}>
            {header}
            {controls}
            <View style={{ paddingHorizontal: 24, gap: 12 }}>
              {filtered.length === 0 ? (
                <FleetMessage title={t('flotte.card.states.noResultTitle')} body={t('flotte.card.states.noResultBody')} />
              ) : (
                filtered.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} showPrice={showPrice} onPress={() => router.push(`/flotte/${vehicle.id}`)} />)
              )}
            </View>
          </ScrollView>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.vehicle.id}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ paddingBottom: tabInset + 8 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            refreshControl={<RefreshControl refreshing={vehiclesQuery.isFetching} onRefresh={refetchAll} tintColor={Palette.primary} />}
            ListHeaderComponent={
              <View>
                {header}
                {watch}
                {controls}
              </View>
            }
            renderSectionHeader={({ section }) => <FleetSectionHeader section={section.key} count={section.data.length} />}
            renderItem={({ item }) => (
              <View style={{ paddingHorizontal: 20 }}>
                <FleetVehicleCard
                  item={item}
                  context={contextOf(item, cardData)}
                  action={actionFor(item, role, rentals, new Date())}
                  showPrice={showPrice}
                  canAddPhoto={canAddVehiclePhoto(role)}
                  onOpen={() => router.push(`/flotte/${item.vehicle.id}`)}
                  onAction={runAction}
                  onAddPhoto={() => router.push({ pathname: '/flotte/[id]/modifier', params: { id: item.vehicle.id, section: 'photos' } })}
                />
              </View>
            )}
            ListEmptyComponent={
              noVehicle ? (
                <FleetMessage title={t('flotte.card.states.emptyTitle')} body={t('flotte.card.states.emptyBody')} actionLabel={t('flotte.card.states.emptyAction')} onAction={() => router.push('/flotte/nouveau')} />
              ) : (
                <FleetMessage title={t('flotte.card.states.noResultTitle')} body={t('flotte.card.states.noResultBody')} />
              )
            }
            ListFooterComponent={sections.length > 0 ? <FleetLegend /> : undefined}
          />
        )}
      </SafeAreaView>

      <OfferSheet
        visible={!!offerVehicle}
        onClose={() => setOfferVehicleId(null)}
        vehicleName={offerVehicle ? `${offerVehicle.marque} ${offerVehicle.modele}`.trim() : ''}
        price={offerVehicle?.prixJour ?? null}
        agencyName={agencyName}
      />
    </ThemedView>
  );
}
