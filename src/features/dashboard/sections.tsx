import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { countByStatus, type StatusFilter } from '@/features/vehicles/filters';
import type { Vehicle } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

import { KpiCard, KpiGrid, SectionTitle } from './kpi-card';
import type { DashboardMetrics, VehiclePerformance } from './kpis';
import { UNDERUSED_THRESHOLD_PCT } from './kpis';
import { MonthChart } from './month-chart';

const mad = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} MAD`;

const FLEET_TILES: { statut: StatusFilter; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { statut: 'disponible', labelKey: 'flotte.status.disponible', icon: 'checkmark-circle-outline' },
  { statut: 'en_location', labelKey: 'flotte.status.en_location', icon: 'key-outline' },
  { statut: 'maintenance', labelKey: 'flotte.status.maintenance', icon: 'construct-outline' },
  { statut: 'a_inspecter', labelKey: 'flotte.status.a_inspecter', icon: 'camera-outline' },
];

const goRentals = () => router.push('/locations');

/** Carte vedette vert forêt : revenus du mois, variation, tendance sur 6 mois. Réservée au propriétaire (avec le reste des finances). */
function RevenueHero({ metrics }: { metrics: DashboardMetrics }) {
  const { t, language } = useLanguage();
  const { revenue } = metrics;
  const change = revenue.changePct;
  const trendIcon = change !== null && change < 0 ? 'trending-down' : 'trending-up';
  return (
    <Card variant="forest" className="gap-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <ThemedText type="small" style={{ color: '#A7F3D0' }}>
            {t('accueil.financial.revenueMonth')}
          </ThemedText>
          <ThemedText type="title" style={{ color: '#FFFFFF' }} accessibilityLabel={`${t('accueil.financial.revenueMonth')} : ${mad(revenue.current)}`}>
            {mad(revenue.current)}
          </ThemedText>
        </View>
        <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
          <Ionicons name={trendIcon} size={22} color="#6EE7B7" />
        </View>
      </View>
      <View className="flex-row items-center gap-1.5 self-start rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
        <Ionicons name={change !== null && change < 0 ? 'arrow-down' : 'arrow-up'} size={14} color={change !== null && change < 0 ? M3akPalette.gold : '#6EE7B7'} />
        <ThemedText type="small" style={{ color: '#FFFFFF' }}>
          {change === null ? t('accueil.financial.noPreviousMonth') : t('accueil.financial.vsLastMonth', { pct: `${change > 0 ? '+' : ''}${change}` })}
        </ThemedText>
      </View>
      <View className="gap-2">
        <ThemedText type="small" style={{ color: '#A7F3D0' }}>
          {t('accueil.financial.trendTitle')}
        </ThemedText>
        <MonthChart points={metrics.revenueTrend} locale={language === 'ar' ? 'ar' : 'fr-FR'} onForest />
      </View>
    </Card>
  );
}

/** Finances : réservé au propriétaire. */
export function FinancialSection({ metrics }: { metrics: DashboardMetrics }) {
  const { t } = useLanguage();
  const { outstanding, activity, maintenance } = metrics;
  return (
    <View className="gap-3">
      <RevenueHero metrics={metrics} />
      <SectionTitle>{t('accueil.financial.title')}</SectionTitle>
      <KpiGrid>
        <KpiCard
          icon="wallet-outline"
          label={t('accueil.financial.outstanding')}
          value={mad(outstanding.total)}
          hint={t('accueil.financial.outstandingHint', { count: outstanding.count })}
          tone={outstanding.total > 0 ? 'warning' : 'good'}
          onPress={goRentals}
        />
        <KpiCard
          icon="stats-chart-outline"
          label={t('accueil.financial.profit30d')}
          value={mad(metrics.profit30d)}
          hint={t('accueil.financial.profitHint')}
          tone={metrics.profit30d < 0 ? 'danger' : 'default'}
        />
        <KpiCard icon="construct-outline" label={t('accueil.financial.maintenanceCost')} value={mad(maintenance.costThisMonth)} />
        <KpiCard icon="basket-outline" label={t('accueil.financial.averageBasket')} value={activity.averageBasket === null ? '—' : mad(activity.averageBasket)} />
        <KpiCard
          icon="close-circle-outline"
          label={t('accueil.financial.cancellationRate')}
          value={`${activity.cancellationRatePct} %`}
          hint={t('accueil.financial.cancelledHint', { count: activity.cancelledThisMonth })}
          tone={activity.cancellationRatePct >= 20 ? 'warning' : 'default'}
        />
      </KpiGrid>
    </View>
  );
}

/** Flotte : état des véhicules et taux d'occupation (tous les rôles). */
export function FleetSection({ metrics, vehicles }: { metrics: DashboardMetrics; vehicles: Vehicle[] }) {
  const { t } = useLanguage();
  const counts = countByStatus(vehicles);
  return (
    <View className="gap-3">
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          {t('accueil.fleetTotal')}
        </ThemedText>
        <ThemedText type="title" >
          {t('accueil.fleetTotalCount', { count: metrics.fleetTotal })}
        </ThemedText>
      </View>
      <KpiGrid>
        {FLEET_TILES.map((tile) => (
          <KpiCard
            key={tile.statut}
            icon={tile.icon}
            label={t(tile.labelKey)}
            value={String(counts[tile.statut])}
            onPress={() => router.push({ pathname: '/flotte', params: { statut: tile.statut } })}
          />
        ))}
        <KpiCard icon="speedometer-outline" label={t('accueil.fleet.utilizationNow')} value={`${metrics.fleetTotal ? Math.round(((counts.en_location ?? 0) / metrics.fleetTotal) * 100) : 0} %`} />
        <KpiCard icon="pie-chart-outline" label={t('accueil.fleet.occupancyMonth')} value={`${metrics.occupancyMonthPct} %`} hint={t('accueil.fleet.occupancyHint')} />
      </KpiGrid>
    </View>
  );
}

/** Activité des locations (propriétaire et responsable). */
export function OperationsSection({ metrics }: { metrics: DashboardMetrics }) {
  const { t } = useLanguage();
  const { activity } = metrics;
  return (
    <View className="gap-3">
      <SectionTitle>{t('accueil.operations.title')}</SectionTitle>
      <KpiGrid>
        <KpiCard icon="arrow-up-circle-outline" label={t('accueil.operations.departuresToday')} value={String(activity.departuresToday)} onPress={goRentals} />
        <KpiCard icon="arrow-down-circle-outline" label={t('accueil.operations.returnsToday')} value={String(activity.returnsToday)} onPress={goRentals} />
        <KpiCard
          icon="alarm-outline"
          label={t('accueil.operations.lateReturns')}
          value={String(activity.lateReturns)}
          tone={activity.lateReturns > 0 ? 'danger' : 'good'}
          onPress={goRentals}
        />
        <KpiCard
          icon="hourglass-outline"
          label={t('accueil.operations.pendingConfirmation')}
          value={String(activity.pendingConfirmation)}
          tone={activity.pendingConfirmation > 0 ? 'warning' : 'default'}
          onPress={goRentals}
        />
        <KpiCard icon="calendar-outline" label={t('accueil.operations.upcoming7Days')} value={String(activity.upcoming7Days)} />
        <KpiCard icon="play-circle-outline" label={t('accueil.operations.activeRentals')} value={String(activity.active)} />
        <KpiCard
          icon="time-outline"
          label={t('accueil.operations.averageDuration')}
          value={activity.averageDurationDays === null ? '—' : t('accueil.operations.days', { count: activity.averageDurationDays })}
        />
        <KpiCard icon="person-add-outline" label={t('accueil.operations.newCustomers')} value={String(metrics.newCustomers)} />
      </KpiGrid>
    </View>
  );
}

/** Travail du jour au comptoir (employé) : ce qu'il faut faire maintenant, sans chiffres d'argent de l'entreprise. */
export function CounterSection({ metrics }: { metrics: DashboardMetrics }) {
  const { t } = useLanguage();
  const { activity, toCollectToday } = metrics;
  return (
    <View className="gap-3">
      <SectionTitle>{t('accueil.counter.title')}</SectionTitle>
      <KpiGrid>
        <KpiCard icon="arrow-up-circle-outline" label={t('accueil.operations.departuresToday')} value={String(activity.departuresToday)} onPress={goRentals} />
        <KpiCard icon="arrow-down-circle-outline" label={t('accueil.operations.returnsToday')} value={String(activity.returnsToday)} onPress={goRentals} />
        <KpiCard
          icon="alarm-outline"
          label={t('accueil.operations.lateReturns')}
          value={String(activity.lateReturns)}
          tone={activity.lateReturns > 0 ? 'danger' : 'good'}
          onPress={goRentals}
        />
        <KpiCard
          icon="hourglass-outline"
          label={t('accueil.operations.pendingConfirmation')}
          value={String(activity.pendingConfirmation)}
          tone={activity.pendingConfirmation > 0 ? 'warning' : 'default'}
          onPress={goRentals}
        />
        <KpiCard
          icon="cash-outline"
          label={t('accueil.counter.toCollect')}
          value={String(toCollectToday.count)}
          hint={t('accueil.counter.toCollectHint')}
          tone={toCollectToday.count > 0 ? 'warning' : 'good'}
          onPress={goRentals}
          wide
        />
        <KpiCard icon="checkmark-circle-outline" label={t('accueil.counter.availableNow')} value={String(metrics.availableNow)} onPress={() => router.push({ pathname: '/flotte', params: { statut: 'disponible' } })} />
        <KpiCard icon="calendar-outline" label={t('accueil.operations.upcoming7Days')} value={String(activity.upcoming7Days)} />
      </KpiGrid>
      <View className="flex-row gap-2">
        <Button label={t('accueil.counter.newRental')} icon="add-circle-outline" style={{ flex: 1 }} onPress={() => router.push('/locations/nouveau')} />
        <Button label={t('accueil.counter.newCustomer')} variant="secondary" icon="person-add-outline" style={{ flex: 1 }} onPress={() => router.push('/clients/nouveau')} />
      </View>
    </View>
  );
}

function VehicleRow({ item, showMoney }: { item: VehiclePerformance; showMoney: boolean }) {
  const { t } = useLanguage();
  return (
    <Card className="flex-row items-center justify-between gap-3">
      <ThemedText type="small" className="flex-1">
        {item.label}
      </ThemedText>
      <View className="items-end">
        <ThemedText type="smallBold" style={{ color: M3akPalette.mauve }}>
          {t('accueil.performance.occupancy', { pct: item.occupancyPct })}
        </ThemedText>
        {showMoney ? (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {mad(item.revenue)}
          </ThemedText>
        ) : null}
      </View>
    </Card>
  );
}

/** Performance de la flotte (propriétaire et responsable) ; l'argent par véhicule n'est visible que du propriétaire. */
export function PerformanceSection({ metrics, showMoney }: { metrics: DashboardMetrics; showMoney: boolean }) {
  const { t } = useLanguage();
  return (
    <View className="gap-3">
      <SectionTitle>{t('accueil.performance.title')}</SectionTitle>
      {showMoney ? (
        <View className="gap-2">
          <ThemedText type="small" themeColor="textSecondary">
            {t('accueil.performance.top')}
          </ThemedText>
          {metrics.topVehicles.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('accueil.performance.noData')}
            </ThemedText>
          ) : (
            metrics.topVehicles.map((item) => <VehicleRow key={item.vehicleId} item={item} showMoney />)
          )}
        </View>
      ) : null}
      <View className="gap-2">
        <ThemedText type="small" themeColor="textSecondary">
          {t('accueil.performance.underused', { pct: UNDERUSED_THRESHOLD_PCT })}
        </ThemedText>
        {metrics.underused.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('accueil.performance.noneUnderused')}
          </ThemedText>
        ) : (
          metrics.underused.map((item) => <VehicleRow key={item.vehicleId} item={item} showMoney={false} />)
        )}
      </View>
    </View>
  );
}

/** Résumé d'entretien : retards et échéances. */
export function MaintenanceSummaryRow({ metrics }: { metrics: DashboardMetrics }) {
  const { t } = useLanguage();
  const { maintenance } = metrics;
  return (
    <KpiGrid>
      <KpiCard
        icon="warning-outline"
        label={t('accueil.maintenanceSummary.overdue')}
        value={String(maintenance.overdue)}
        tone={maintenance.overdue > 0 ? 'danger' : 'good'}
        onPress={() => router.push('/maintenance')}
      />
      <KpiCard
        icon="calendar-outline"
        label={t('accueil.maintenanceSummary.due')}
        value={String(maintenance.due)}
        tone={maintenance.due > 0 ? 'warning' : 'default'}
        onPress={() => router.push('/maintenance')}
      />
    </KpiGrid>
  );
}
