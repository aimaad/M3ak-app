import { Redirect, router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { Card, PressableCard } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { signOut } from '@/features/auth/api';
import { useMyAgency } from '@/features/agency/hooks';
import { computeUtilizationRate, revenueByDay, sumPaymentsInMonth } from '@/features/dashboard/metrics';
import { RevenueChart } from '@/features/dashboard/revenue-chart';
import { useMaintenanceItems } from '@/features/maintenance/hooks';
import { MaintenanceRow } from '@/features/maintenance/maintenance-row';
import { useAllPayments } from '@/features/payments/hooks';
import { countByStatus } from '@/features/vehicles/filters';
import { useVehicles } from '@/features/vehicles/hooks';
import type { StatusFilter } from '@/features/vehicles/filters';
import type { Vehicle } from '@/features/vehicles/types';
import type { Payment } from '@/features/payments/types';
import { useLanguage } from '@/i18n/use-language';

const EMPTY_VEHICLES: Vehicle[] = [];
const EMPTY_PAYMENTS: Payment[] = [];
const CHART_DAYS = 7;

const KPI_TILES: { statut: StatusFilter; labelKey: string }[] = [
  { statut: 'disponible', labelKey: 'flotte.status.disponible' },
  { statut: 'en_location', labelKey: 'flotte.status.en_location' },
  { statut: 'maintenance', labelKey: 'flotte.status.maintenance' },
  { statut: 'a_inspecter', labelKey: 'flotte.status.a_inspecter' },
];

export default function AccueilScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const vehiclesQuery = useVehicles();
  const paymentsQuery = useAllPayments();
  const maintenanceQuery = useMaintenanceItems();

  const vehicles = vehiclesQuery.data ?? EMPTY_VEHICLES;
  const payments = paymentsQuery.data ?? EMPTY_PAYMENTS;
  const counts = useMemo(() => countByStatus(vehicles), [vehicles]);
  const utilizationRate = useMemo(() => computeUtilizationRate(vehicles), [vehicles]);
  const revenue = useMemo(() => sumPaymentsInMonth(payments), [payments]);
  const chartPoints = useMemo(() => revenueByDay(payments, CHART_DAYS), [payments]);

  const urgentMaintenance = (maintenanceQuery.data ?? [])
    .filter((item) => item.statut !== 'effectuee')
    .slice(0, 4);

  const isRefreshing =
    vehiclesQuery.isFetching || paymentsQuery.isFetching || maintenanceQuery.isFetching;

  function handleRefresh() {
    vehiclesQuery.refetch();
    paymentsQuery.refetch();
    maintenanceQuery.refetch();
  }

  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  if (agencyQuery.isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator color={M3akPalette.mauve} />
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
          title={t('accueil.greeting', { name: agencyQuery.data?.memberName ?? '' })}
          subtitle={today}
          right={
            <Pressable onPress={() => signOut()} hitSlop={8}>
              <ThemedText type="small" themeColor="primary">
                {t('auth.signOut')}
              </ThemedText>
            </Pressable>
          }
        />

        {vehiclesQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="gap-6 px-6 pb-28"
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={M3akPalette.mauve} />
            }
          >
            <View>
              <ThemedText type="small" themeColor="textSecondary">
                {t('accueil.fleetTotal')}
              </ThemedText>
              <ThemedText type="title" className="font-cairo-bold">
                {t('accueil.fleetTotalCount', { count: vehicles.length })}
              </ThemedText>
            </View>

            <View className="flex-row flex-wrap gap-3">
              {KPI_TILES.map((tile) => (
                <PressableCard
                  key={tile.statut}
                  onPress={() => router.push({ pathname: '/flotte', params: { statut: tile.statut } })}
                  className="w-[47%] gap-1"
                >
                  <ThemedText type="title" themeColor="primary">
                    {counts[tile.statut]}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(tile.labelKey)}
                  </ThemedText>
                </PressableCard>
              ))}
            </View>

            <View className="flex-row gap-3">
              <Card className="flex-1 gap-1">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('accueil.utilizationRate')}
                </ThemedText>
                <ThemedText type="subtitle" className="font-cairo-semibold">
                  {`${utilizationRate}%`}
                </ThemedText>
              </Card>
              <Card className="flex-1 gap-1">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('accueil.revenueThisMonth')}
                </ThemedText>
                <ThemedText type="subtitle" className="font-cairo-semibold">
                  {`${revenue.toLocaleString('fr-FR')} MAD`}
                </ThemedText>
              </Card>
            </View>

            <Card className="gap-3">
              <ThemedText type="smallBold">{t('accueil.revenueChartTitle', { days: CHART_DAYS })}</ThemedText>
              <RevenueChart points={chartPoints} />
            </Card>

            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <ThemedText type="smallBold">{t('accueil.maintenanceSection')}</ThemedText>
                <Pressable onPress={() => router.push('/maintenance')}>
                  <ThemedText type="small" themeColor="primary">
                    {t('accueil.seeAll')}
                  </ThemedText>
                </Pressable>
              </View>

              {urgentMaintenance.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('accueil.maintenanceEmpty')}
                </ThemedText>
              ) : (
                <View className="gap-2">
                  {urgentMaintenance.map((item) => {
                    const vehicle = vehicles.find((v) => v.id === item.vehicleId);
                    return (
                      <MaintenanceRow
                        key={item.id}
                        item={item}
                        vehicleLabel={vehicle ? `${vehicle.marque} ${vehicle.modele}` : undefined}
                        currentKm={vehicle?.kilometrage ?? null}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        )}

        <BottomTabBar current="accueil" />
      </SafeAreaView>
    </ThemedView>
  );
}
