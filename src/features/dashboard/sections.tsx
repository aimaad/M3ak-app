import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/theme';
import { countByStatus } from '@/features/vehicles/filters';
import type { Vehicle } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

import { FleetDonut } from './fleet-donut';
import { KpiCard, KpiGrid, SectionTitle } from './kpi-card';
import type { DashboardMetrics, VehiclePerformance } from './kpis';
import { UNDERUSED_THRESHOLD_PCT } from './kpis';

const mad = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} MAD`;

const goRentals = () => router.push('/locations');

/** Finances : réservé au propriétaire. */
export function FinancialSection({ metrics }: { metrics: DashboardMetrics }) {
  const { t } = useLanguage();
  const { outstanding, activity, maintenance } = metrics;
  return (
    <View className="gap-3">
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
          value={mad(metrics.profit)}
          hint={t('accueil.financial.profitHint')}
          tone={metrics.profit < 0 ? 'danger' : 'default'}
        />
        <KpiCard
          icon="construct-outline"
          label={t('accueil.financial.maintenanceCost')}
          value={mad(maintenance.costInPeriod)}
        />
        <KpiCard
          icon="basket-outline"
          label={t('accueil.financial.averageBasket')}
          value={activity.averageBasket === null ? '—' : mad(activity.averageBasket)}
        />
        <KpiCard
          icon="close-circle-outline"
          label={t('accueil.financial.cancellationRate')}
          value={`${activity.cancellationRatePct} %`}
          hint={t('accueil.period.cancelledHint', { count: activity.cancelled })}
          tone={activity.cancellationRatePct >= 20 ? 'warning' : 'default'}
        />
      </KpiGrid>
    </View>
  );
}

/** Flotte : état des véhicules et taux d'occupation (tous les rôles). */
export function FleetSection({
  metrics,
  vehicles,
}: {
  metrics: DashboardMetrics;
  vehicles: Vehicle[];
}) {
  const { t } = useLanguage();
  const counts = countByStatus(vehicles);
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <SectionTitle>{t('accueil.fleet.title')}</SectionTitle>
        <Pressable
          onPress={() => router.push('/flotte')}
          accessibilityRole="link"
          hitSlop={8}
          className="min-h-11 flex-row items-center justify-center"
          style={{ gap: 4 }}
        >
          <ThemedText type="smallBold" style={{ color: Palette.primary }}>
            {t('accueil.fleet.seeFleet')}
          </ThemedText>
          <Ionicons name="arrow-forward" size={16} color={Palette.primary} />
        </Pressable>
      </View>
      <FleetDonut vehicles={vehicles} />
      <KpiGrid>
        <KpiCard
          icon="speedometer-outline"
          label={t('accueil.fleet.utilizationNow')}
          value={`${metrics.fleetTotal ? Math.round(((counts.en_location ?? 0) / metrics.fleetTotal) * 100) : 0} %`}
        />
        <KpiCard
          icon="pie-chart-outline"
          label={t('accueil.fleet.occupancyMonth')}
          value={`${metrics.occupancyPct} %`}
          hint={t('accueil.fleet.occupancyHint')}
        />
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
        <KpiCard
          icon="arrow-up-circle-outline"
          label={t('accueil.operations.departuresToday')}
          value={String(activity.departuresToday)}
          onPress={goRentals}
        />
        <KpiCard
          icon="arrow-down-circle-outline"
          label={t('accueil.operations.returnsToday')}
          value={String(activity.returnsToday)}
          onPress={goRentals}
        />
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
          icon="calendar-outline"
          label={t('accueil.operations.upcoming7Days')}
          value={String(activity.upcoming7Days)}
        />
        <KpiCard
          icon="play-circle-outline"
          label={t('accueil.operations.activeRentals')}
          value={String(activity.active)}
        />
        <KpiCard
          icon="time-outline"
          label={t('accueil.operations.averageDuration')}
          value={
            activity.averageDurationDays === null
              ? '—'
              : t('accueil.operations.days', { count: activity.averageDurationDays })
          }
        />
        <KpiCard
          icon="person-add-outline"
          label={t('accueil.operations.newCustomers')}
          value={String(metrics.newCustomers)}
        />
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
        <KpiCard
          icon="arrow-up-circle-outline"
          label={t('accueil.operations.departuresToday')}
          value={String(activity.departuresToday)}
          onPress={goRentals}
        />
        <KpiCard
          icon="arrow-down-circle-outline"
          label={t('accueil.operations.returnsToday')}
          value={String(activity.returnsToday)}
          onPress={goRentals}
        />
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
        <KpiCard
          icon="checkmark-circle-outline"
          label={t('accueil.counter.availableNow')}
          value={String(metrics.availableNow)}
          onPress={() => router.push({ pathname: '/flotte', params: { statut: 'disponible' } })}
        />
        <KpiCard
          icon="calendar-outline"
          label={t('accueil.operations.upcoming7Days')}
          value={String(activity.upcoming7Days)}
        />
      </KpiGrid>
      <View className="flex-row gap-2">
        <Button
          label={t('accueil.counter.newRental')}
          icon="add-circle-outline"
          style={{ flex: 1 }}
          onPress={() => router.push('/locations/nouveau')}
        />
        <Button
          label={t('accueil.counter.newCustomer')}
          variant="secondary"
          icon="person-add-outline"
          style={{ flex: 1 }}
          onPress={() => router.push('/clients/nouveau')}
        />
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
        <ThemedText type="smallBold" style={{ color: Palette.primary }}>
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
export function PerformanceSection({
  metrics,
  showMoney,
}: {
  metrics: DashboardMetrics;
  showMoney: boolean;
}) {
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
            metrics.topVehicles.map((item) => (
              <VehicleRow key={item.vehicleId} item={item} showMoney />
            ))
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
          metrics.underused.map((item) => (
            <VehicleRow key={item.vehicleId} item={item} showMoney={false} />
          ))
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
