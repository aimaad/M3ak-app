import { Redirect, router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BottomTabBar } from '@/components/bottom-tab-bar';
import { PressableCard } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useAgencyDetails, useMyAgency, useMyProfile } from '@/features/agency/hooks';
import { getInitials } from '@/lib/initials';
import { customerDocumentAlerts } from '@/features/customers/document-alerts';
import { AiInsightsSection } from '@/features/dashboard/ai-insights-section';
import { useAiInsights, useDashboardMetrics } from '@/features/dashboard/hooks';
import { dashboardSections, canSeeMoney } from '@/features/dashboard/role-layout';
import {
  CounterSection,
  FinancialSection,
  FleetSection,
  MaintenanceSummaryRow,
  OperationsSection,
  PerformanceSection,
} from '@/features/dashboard/sections';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { useOcrSettings } from '@/features/ocr/hooks';
import { MaintenanceRow } from '@/features/maintenance/maintenance-row';
import { vehicleDocumentAlerts } from '@/features/vehicles/document-alerts';
import type { ExpiryUrgency } from '@/lib/expiry';
import { useLanguage } from '@/i18n/use-language';

type DocumentAlertItem = {
  key: string;
  name: string;
  expiresAt: string;
  urgency: Exclude<ExpiryUrgency, 'ok'>;
  href: `/clients/${string}` | `/flotte/${string}`;
};

const URGENCY_COLOR: Record<Exclude<ExpiryUrgency, 'ok'>, string> = {
  bientot: M3akPalette.warning,
  expire: M3akPalette.danger,
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AccueilScreen() {
  const { t, language } = useLanguage();
  const agencyQuery = useMyAgency();
  const profileQuery = useMyProfile(agencyQuery.data?.agencyId);
  const role = agencyQuery.data?.role;
  const agencyDetails = useAgencyDetails(role === 'owner' ? agencyQuery.data?.agencyId : undefined);
  const logoMissing = role === 'owner' && !!agencyDetails.data && !agencyDetails.data.logoUrl;
  const sections = dashboardSections(role);

  const { metrics, vehicles, maintenanceItems, customers, isLoading, isComplete, isRefreshing, refetchAll } = useDashboardMetrics();
  const { agencyId, insightsAvailability } = useOcrSettings();
  const insights = useAiInsights({
    enabled: insightsAvailability === 'active' && isComplete,
    agencyId,
    role,
    language: language === 'ar' ? 'ar' : 'fr',
    metrics,
  });

  const urgentMaintenance = maintenanceItems.filter((item) => item.statut !== 'effectuee').slice(0, 4);

  const documentAlerts: DocumentAlertItem[] = useMemo(() => {
    const fromCustomers: DocumentAlertItem[] = customerDocumentAlerts(customers).map((a) => ({
      key: `c-${a.customerId}-${a.type}`,
      name: a.customerName,
      expiresAt: a.expiresAt,
      urgency: a.urgency,
      href: `/clients/${a.customerId}`,
    }));
    const fromVehicles: DocumentAlertItem[] = vehicleDocumentAlerts(vehicles).map((a) => ({
      key: `v-${a.vehicleId}-${a.type}`,
      name: a.vehicleLabel,
      expiresAt: a.expiresAt,
      urgency: a.urgency,
      href: `/flotte/${a.vehicleId}`,
    }));
    return [...fromCustomers, ...fromVehicles].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)).slice(0, 4);
  }, [customers, vehicles]);

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
            <View className="flex-row items-center gap-3">
              <NotificationBell />
              <Pressable onPress={() => router.push('/profil')} hitSlop={8}>
                <Avatar
                  path={profileQuery.data?.photoPath}
                  size={40}
                  initials={getInitials(profileQuery.data?.nomComplet ?? agencyQuery.data?.memberName)}
                />
              </Pressable>
            </View>
          }
        />

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="gap-6 px-6 pb-28"
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={refetchAll} tintColor={M3akPalette.mauve} />
            }
          >
            <ThemedText type="small" themeColor="textSecondary">
              {t(`accueil.roleView.${role ?? 'employee'}`)}
            </ThemedText>

            {logoMissing ? (
              <Pressable onPress={() => router.push('/entreprise')} className="gap-1 rounded-2xl bg-[#FEE2E2] px-4 py-3">
                <ThemedText type="smallBold" style={{ color: M3akPalette.danger }}>
                  {t('entreprise.logo.homeNoticeTitle')}
                </ThemedText>
                <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                  {t('entreprise.logo.homeNotice')}
                </ThemedText>
              </Pressable>
            ) : null}

            {sections.map((section) => {
              switch (section) {
                case 'financial':
                  return <FinancialSection key={section} metrics={metrics} />;
                case 'fleet':
                  return <FleetSection key={section} metrics={metrics} vehicles={vehicles} />;
                case 'operations':
                  return <OperationsSection key={section} metrics={metrics} />;
                case 'counter':
                  return <CounterSection key={section} metrics={metrics} />;
                case 'performance':
                  return <PerformanceSection key={section} metrics={metrics} showMoney={canSeeMoney(role)} />;
                case 'ai':
                  return (
                    <AiInsightsSection
                      key={section}
                      availability={insightsAvailability}
                      isLoading={insights.isFetching}
                      error={insights.error}
                      data={insights.data}
                      onRefresh={insights.refresh}
                    />
                  );
                case 'alerts':
                  return documentAlerts.length > 0 ? (
                    <View key={section} className="gap-3">
                      <ThemedText type="smallBold">{t('accueil.documentAlertsSection')}</ThemedText>
                      <View className="gap-2">
                        {documentAlerts.map((alert) => (
                          <PressableCard key={alert.key} onPress={() => router.push(alert.href)} className="flex-row items-center justify-between">
                            <ThemedText type="small">{alert.name}</ThemedText>
                            <ThemedText type="small" style={{ color: URGENCY_COLOR[alert.urgency] }}>
                              {formatShortDate(alert.expiresAt)}
                            </ThemedText>
                          </PressableCard>
                        ))}
                      </View>
                    </View>
                  ) : null;
                case 'maintenance':
                  return (
                    <View key={section} className="gap-3">
                      <View className="flex-row items-center justify-between">
                        <ThemedText type="smallBold">{t('accueil.maintenanceSection')}</ThemedText>
                        <Pressable onPress={() => router.push('/maintenance')}>
                          <ThemedText type="small" themeColor="primary">
                            {t('accueil.seeAll')}
                          </ThemedText>
                        </Pressable>
                      </View>
                      <MaintenanceSummaryRow metrics={metrics} />
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
                  );
                default:
                  return null;
              }
            })}
          </ScrollView>
        )}

        <BottomTabBar current="accueil" />
      </SafeAreaView>
    </ThemedView>
  );
}
