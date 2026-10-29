import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { PressableCard } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette, Shadows } from '@/constants/theme';
import { daysLeft, shouldShowTrialBanner } from '@/features/agency/access';
import {
  useAgencyAccess,
  useAgencyDetails,
  useMyAgency,
  useMyProfile,
} from '@/features/agency/hooks';
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
import { useStoredFlag } from '@/features/onboarding/use-stored-flag';
import { shouldAutoOpenWelcome, welcomeSeenKey } from '@/features/onboarding/welcome-flow';
import { GettingStartedCard } from '@/features/onboarding/getting-started-card';
import {
  buildGettingStarted,
  shouldShowGettingStarted,
} from '@/features/onboarding/getting-started';
import { useSession } from '@/features/auth/session-context';
import { useRentals } from '@/features/rentals/hooks';
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
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

type QuickItem = {
  href: '/contrats' | '/maintenance' | '/chat' | '/journal' | '/entreprise';
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  managersOnly?: boolean;
  ownerOnly?: boolean;
};

const QUICK_ITEMS: QuickItem[] = [
  { href: '/contrats', labelKey: 'contract.listTitle', icon: 'document-text-outline' },
  { href: '/maintenance', labelKey: 'maintenance.title', icon: 'construct-outline' },
  { href: '/chat', labelKey: 'chat.title', icon: 'chatbubbles-outline' },
  {
    href: '/entreprise',
    labelKey: 'entreprise.title',
    icon: 'business-outline',
    managersOnly: true,
  },
  {
    href: '/journal',
    labelKey: 'journal.title',
    icon: 'shield-checkmark-outline',
    ownerOnly: true,
  },
];

/** Raccourcis vers les écrans qui n'ont pas d'onglet : sans eux, Contrats et Maintenance étaient presque introuvables. */
function QuickAccess({ role }: { role: string | null | undefined }) {
  const { t } = useLanguage();
  const items = QUICK_ITEMS.filter(
    (item) =>
      (!item.ownerOnly || role === 'owner') &&
      (!item.managersOnly || role === 'owner' || role === 'manager')
  );
  return (
    <View className="gap-2">
      <ThemedText type="smallBold">{t('onboarding.quick.title')}</ThemedText>
      <View className="flex-row flex-wrap gap-2">
        {items.map((item) => (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href)}
            accessibilityRole="link"
            className="min-h-11 flex-row items-center gap-2 rounded-full border border-[#E4DCF5] bg-white px-4"
          >
            <Ionicons name={item.icon} size={18} color={M3akPalette.mauve} />
            <ThemedText type="smallBold">{t(item.labelKey)}</ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function AccueilScreen() {
  const { t, language } = useLanguage();
  const agencyQuery = useMyAgency();
  const profileQuery = useMyProfile(agencyQuery.data?.agencyId);
  const role = agencyQuery.data?.role;
  const agencyDetails = useAgencyDetails(role === 'owner' ? agencyQuery.data?.agencyId : undefined);
  const logoMissing = role === 'owner' && !!agencyDetails.data && !agencyDetails.data.logoUrl;
  const accessQuery = useAgencyAccess();
  const trialDays = shouldShowTrialBanner(accessQuery.data ?? null)
    ? daysLeft(accessQuery.data?.accessUntil ?? null)
    : null;
  const sections = dashboardSections(role);

  const {
    metrics,
    vehicles,
    maintenanceItems,
    customers,
    isLoading,
    isComplete,
    isRefreshing,
    refetchAll,
  } = useDashboardMetrics();
  const { agencyId, insightsAvailability } = useOcrSettings();
  const insights = useAiInsights({
    enabled: insightsAvailability === 'active' && isComplete,
    agencyId,
    role,
    language: language === 'ar' ? 'ar' : 'fr',
    metrics,
  });

  const { session } = useSession();
  const rentalsQuery = useRentals();
  const gettingStarted = buildGettingStarted({
    role,
    hasLogo: !!agencyDetails.data?.logoUrl,
    vehicleCount: vehicles.length,
    customerCount: customers.length,
    rentalCount: rentalsQuery.data?.length ?? 0,
  });
  // On attend les données (et le logo pour le propriétaire) avant de proposer des étapes « à faire ».
  const startReady =
    isComplete && rentalsQuery.isSuccess && (role !== 'owner' || agencyDetails.isSuccess);
  const startVisible = startReady && shouldShowGettingStarted(gettingStarted, false);

  // Toute première arrivée dans une agence encore vide : parcours de bienvenue plein écran (une seule fois).
  const [welcomeSeen] = useStoredFlag(welcomeSeenKey(session?.user.id, agencyQuery.data?.agencyId));
  const openWelcome =
    startReady &&
    shouldAutoOpenWelcome({
      steps: gettingStarted,
      seen: welcomeSeen,
      vehicleCount: vehicles.length,
      customerCount: customers.length,
      rentalCount: rentalsQuery.data?.length ?? 0,
    });
  useEffect(() => {
    if (openWelcome) router.replace('/bienvenue');
  }, [openWelcome]);

  const urgentMaintenance = maintenanceItems
    .filter((item) => item.statut !== 'effectuee')
    .slice(0, 4);

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
    return [...fromCustomers, ...fromVehicles]
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
      .slice(0, 4);
  }, [customers, vehicles]);

  const today = new Date().toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (agencyQuery.isPending) {
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
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
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
                  initials={getInitials(
                    profileQuery.data?.nomComplet ?? agencyQuery.data?.memberName
                  )}
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
            contentContainerClassName="gap-6 px-6 pb-10"
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refetchAll}
                tintColor={M3akPalette.mauve}
              />
            }
          >
            <Pressable
              onPress={() => router.push('/chat')}
              className="flex-row items-center gap-3 rounded-3xl border border-[#E4DCF5] bg-white p-4"
              style={Shadows.card}
              accessibilityRole="button"
            >
              <View
                className="h-12 w-12 items-center justify-center rounded-full"
                style={{
                  backgroundColor: M3akPalette.mauve,
                  ...Shadows.button,
                  shadowOpacity: 0.25,
                }}
              >
                <Ionicons name="sparkles" size={22} color="#FFFFFF" />
              </View>
              <View className="flex-1 gap-0.5">
                <ThemedText type="smallBold">{t('accueil.askM3ak.title')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('accueil.askM3ak.hint')}
                </ThemedText>
              </View>
            </Pressable>

            <ThemedText type="small" themeColor="textSecondary">
              {t(`accueil.roleView.${role ?? 'employee'}`)}
            </ThemedText>

            {trialDays !== null ? (
              <View className="gap-1 rounded-2xl bg-[#FEF3C7] px-4 py-3">
                <ThemedText type="smallBold" style={{ color: '#92400E' }}>
                  {t('access.trialBannerTitle')}
                </ThemedText>
                <ThemedText type="small" style={{ color: '#92400E' }}>
                  {trialDays <= 1
                    ? t('access.trialLastDay')
                    : t('access.trialDays', { days: trialDays })}
                </ThemedText>
              </View>
            ) : null}

            <QuickAccess role={role} />

            <GettingStartedCard
              steps={gettingStarted}
              userId={session?.user.id}
              agencyId={agencyQuery.data?.agencyId}
              ready={startReady}
            />

            {logoMissing && !startVisible ? (
              <Pressable
                onPress={() => router.push('/entreprise')}
                className="gap-1 rounded-2xl bg-[#FEE2E2] px-4 py-3"
              >
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
                  return (
                    <PerformanceSection
                      key={section}
                      metrics={metrics}
                      showMoney={canSeeMoney(role)}
                    />
                  );
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
                          <PressableCard
                            key={alert.key}
                            onPress={() => router.push(alert.href)}
                            className="flex-row items-center justify-between"
                          >
                            <ThemedText type="small">{alert.name}</ThemedText>
                            <ThemedText
                              type="small"
                              style={{ color: URGENCY_COLOR[alert.urgency] }}
                            >
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
                                vehicleLabel={
                                  vehicle ? `${vehicle.marque} ${vehicle.modele}` : undefined
                                }
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
      </SafeAreaView>
    </ThemedView>
  );
}
