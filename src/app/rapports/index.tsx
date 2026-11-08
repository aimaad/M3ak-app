import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { Brand, Palette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { buildAvailability, conflicts as availabilityConflicts } from '@/features/dashboard/availability';
import { useRentals } from '@/features/rentals/hooks';
import { AiInsightsSection } from '@/features/dashboard/ai-insights-section';
import { formatAmount, HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useAiInsights, useDashboardMetrics } from '@/features/dashboard/hooks';
import { DASHBOARD_PERIODS, type DashboardPeriod } from '@/features/dashboard/kpis';
import { buildPriorities, priorityHref } from '@/features/dashboard/priorities';
import { canSeeMoney, canUseAiInsights } from '@/features/dashboard/role-layout';
import { FinancialSection, FleetSection, MaintenanceSummaryRow, OperationsSection, PerformanceSection } from '@/features/dashboard/sections';
import { usePersistedPeriod } from '@/features/dashboard/use-persisted-period';
import { customerDocumentAlerts } from '@/features/customers/document-alerts';
import { MaintenanceRow } from '@/features/maintenance/maintenance-row';
import { useOcrSettings } from '@/features/ocr/hooks';
import { vehicleDocumentAlerts } from '@/features/vehicles/document-alerts';
import { useLanguage } from '@/i18n/use-language';

type TabKey = 'finances' | 'activity' | 'fleet' | 'ai';

const PERIOD_KEY: Record<DashboardPeriod, string> = { today: 'accueil.period.tabs.today', '7d': 'accueil.period.tabs.days7', '30d': 'accueil.period.tabs.days30' };

/**
 * Rapports : ce qu'on consulte chaque semaine pour piloter. Quatre rubriques (Finances, Activité, Flotte, Analyse IA) ; les
 * chiffres déplacés depuis l'accueil, avec le même filtre de période. Finances : propriétaire ; Analyse IA : propriétaire et
 * responsable.
 */
export default function RapportsScreen() {
  const { t, language } = useLanguage();
  const agency = useMyAgency();
  const role = agency.data?.role;
  const tabs: TabKey[] = [
    ...(canSeeMoney(role) ? (['finances'] as const) : []),
    'activity',
    'fleet',
    ...(canUseAiInsights(role) ? (['ai'] as const) : []),
  ];
  const [selected, setSelected] = useState<TabKey>(tabs[0]);
  const tab = tabs.includes(selected) ? selected : tabs[0];
  const [period, setPeriod] = usePersistedPeriod();
  const { metrics, insightsMetrics, vehicles, customers, maintenanceItems, isComplete } = useDashboardMetrics(period);
  const { agencyId, insightsAvailability } = useOcrSettings();
  const insights = useAiInsights({
    enabled: insightsAvailability === 'active' && isComplete && tab === 'ai',
    agencyId,
    role,
    language: language === 'ar' ? 'ar' : 'fr',
    metrics: insightsMetrics,
  });

  const expiredDocuments = useMemo(
    () => [...customerDocumentAlerts(customers), ...vehicleDocumentAlerts(vehicles)].filter((a) => a.urgency === 'expire').length,
    [customers, vehicles]
  );
  const rentalsQuery = useRentals();
  const conflicts = useMemo(
    () => availabilityConflicts(buildAvailability({ vehicles, rentals: rentalsQuery.data ?? [], maintenance: maintenanceItems, now: new Date() })),
    [vehicles, rentalsQuery.data, maintenanceItems]
  );
  const priorities = buildPriorities({
    showMoney: canSeeMoney(role),
    lateReturns: metrics.activity.lateReturns,
    conflicts,
    unpaid: metrics.outstanding,
    expiredDocuments,
    overdueMaintenance: metrics.maintenance.overdue,
    stoppedVehicles: metrics.stopped.length,
  });
  const urgentMaintenance = maintenanceItems.filter((item) => item.statut !== 'effectuee').slice(0, 4);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('rapports.title')} showBack />

        {/* Rubriques : onglets soulignés (actif graphite + trait orange). */}
        <View accessibilityRole="tablist" accessibilityLabel={t('rapports.tabsLabel')} style={{ flexDirection: 'row', gap: 20, marginHorizontal: 24, borderBottomWidth: 1, borderBottomColor: Palette.border }}>
          {tabs.map((key) => {
            const active = key === tab;
            return (
              <Pressable
                key={key}
                onPress={() => setSelected(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={{ height: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: active ? Brand.orange : 'transparent', marginBottom: -1 }}
              >
                <HText weight={active ? 'semibold' : 'medium'} size={14} color={active ? Palette.textPrimary : Palette.textSecondary}>
                  {t(`rapports.tabs.${key}`)}
                </HText>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}>
          {tab !== 'ai' ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {DASHBOARD_PERIODS.map((key) => {
                const active = key === period;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setPeriod(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <View style={{ height: 36, borderRadius: 18, borderWidth: 1, borderColor: active ? Brand.graphite : Palette.border, backgroundColor: active ? Brand.graphite : Palette.card, paddingHorizontal: 14, justifyContent: 'center' }}>
                      <HText weight="medium" size={13} color={active ? Brand.white : Palette.textPrimary}>
                        {t(PERIOD_KEY[key])}
                      </HText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {tab === 'finances' ? <FinancialSection metrics={metrics} /> : null}

          {tab === 'activity' ? <OperationsSection metrics={metrics} /> : null}

          {tab === 'fleet' ? (
            <>
              <FleetSection metrics={metrics} vehicles={vehicles} />
              <PerformanceSection metrics={metrics} showMoney={canSeeMoney(role)} />
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <MicroLabel size={11} track={0.16}>
                    {t('accueil.maintenanceSection')}
                  </MicroLabel>
                  <Pressable onPress={() => router.push('/maintenance')} hitSlop={10} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
                    <HText weight="semibold" size={13}>
                      {t('accueil.seeAll')}
                    </HText>
                  </Pressable>
                </View>
                <MaintenanceSummaryRow metrics={metrics} />
                {urgentMaintenance.length === 0 ? (
                  <HText size={13} color={Palette.textSecondary}>
                    {t('accueil.maintenanceEmpty')}
                  </HText>
                ) : (
                  <View style={{ gap: 8 }}>
                    {urgentMaintenance.map((item) => {
                      const vehicle = vehicles.find((v) => v.id === item.vehicleId);
                      return <MaintenanceRow key={item.id} item={item} vehicleLabel={vehicle ? `${vehicle.marque} ${vehicle.modele}` : undefined} currentKm={vehicle?.kilometrage ?? null} />;
                    })}
                  </View>
                )}
              </View>
            </>
          ) : null}

          {tab === 'ai' ? (
            <>
              {/* Liste complète des priorités du jour (l'accueil n'en montre que 3). */}
              <View style={{ gap: 12 }}>
                <MicroLabel size={11} track={0.16}>
                  {t('rapports.priorities')}
                </MicroLabel>
                {priorities.length === 0 ? (
                  <HText size={13} color={Palette.textSecondary}>
                    {t('accueil.home.priorities.allClearHint')}
                  </HText>
                ) : (
                  priorities.map((p) => {
                    const base = `accueil.home.priorities.${p.kind}`;
                    return (
                      <Pressable
                        key={p.kind}
                        onPress={() => router.push(priorityHref(p) as never)}
                        accessibilityRole="button"
                        style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: Palette.border, borderRadius: 18, padding: 14, backgroundColor: Palette.card }}
                      >
                        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
                          <HText font="display" weight="semibold" size={18} color={Brand.white}>
                            {String(p.count)}
                          </HText>
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <MicroLabel size={10} track={0.14} color={Palette.textSecondary}>
                            {t(`${base}.label`)}
                          </MicroLabel>
                          <HText size={14} weight="medium" numberOfLines={2}>
                            {t(`${base}.desc`, { count: p.count, amount: formatAmount(p.amount ?? 0) })}
                          </HText>
                        </View>
                        <Ionicons name={language === 'ar' ? 'chevron-back' : 'chevron-forward'} size={18} color={Palette.textMuted} />
                      </Pressable>
                    );
                  })
                )}
              </View>
              <AiInsightsSection
                availability={insightsAvailability}
                isLoading={insights.isFetching}
                error={insights.error}
                data={insights.data}
                onRefresh={insights.refresh}
              />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
