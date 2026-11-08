import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Palette } from '@/constants/theme';
import { daysLeft, shouldShowTrialBanner } from '@/features/agency/access';
import { useAgencyAccess, useAgencyDetails, useMyAgency, useMyProfile } from '@/features/agency/hooks';
import { useSession } from '@/features/auth/session-context';
import { customerDocumentAlerts } from '@/features/customers/document-alerts';
import { AgendaSection } from '@/features/dashboard/agenda-section';
import { AvailabilitySection } from '@/features/dashboard/availability-section';
import { buildAvailability, conflicts as availabilityConflicts, freeToday, parcCounts } from '@/features/dashboard/availability';
import { AskBibip } from '@/features/dashboard/ask-bibip';
import { buildBriefing } from '@/features/dashboard/briefing';
import { useBriefingLang } from '@/features/dashboard/use-briefing-lang';
import { HomeHeader } from '@/features/dashboard/home-header';
import { HomeNotice, pickNotice, type NoticeKind } from '@/features/dashboard/home-notice';
import { Skeleton } from '@/features/dashboard/home-ui';
import { useAiInsights, useDashboardMetrics } from '@/features/dashboard/hooks';
import type { RentalFocus } from '@/features/dashboard/kpis';
import { ParcSection } from '@/features/dashboard/parc-section';
import { buildPriorities } from '@/features/dashboard/priorities';
import { ProfileSheet } from '@/features/dashboard/profile-sheet';
import { PrioritiesSection } from '@/features/dashboard/priorities-carousel';
import { canSeeMoney } from '@/features/dashboard/role-layout';
import { usePersistedPeriod } from '@/features/dashboard/use-persisted-period';
import { headerFirstName } from '@/features/dashboard/header-format';
import { buildGettingStarted, dismissKey, progressOf, shouldShowGettingStarted } from '@/features/onboarding/getting-started';
import { useStoredFlag } from '@/features/onboarding/use-stored-flag';
import { shouldAutoOpenWelcome, welcomeSeenKey } from '@/features/onboarding/welcome-flow';
import { useOcrSettings } from '@/features/ocr/hooks';
import { useRentals } from '@/features/rentals/hooks';
import { vehicleDocumentAlerts } from '@/features/vehicles/document-alerts';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { getInitials } from '@/lib/initials';
import { useLanguage } from '@/i18n/use-language';

export default function AccueilScreen() {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const profileQuery = useMyProfile(agencyId);
  const role = agencyQuery.data?.role;
  const showMoney = canSeeMoney(role);
  const agencyDetails = useAgencyDetails(role === 'owner' ? agencyId : undefined);
  const accessQuery = useAgencyAccess();
  const trialDays = shouldShowTrialBanner(accessQuery.data ?? null) ? daysLeft(accessQuery.data?.accessUntil ?? null) : null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [briefingLang, setBriefingLang] = useBriefingLang(language);
  const [period, setPeriod] = usePersistedPeriod();
  const { metrics, insightsMetrics, vehicles, customers, maintenanceItems, isError, isLoading, updatedAt, isComplete, isRefreshing, refetchAll } = useDashboardMetrics(period);
  const { agencyId: ocrAgencyId, insightsAvailability, chatAvailability } = useOcrSettings();
  const insights = useAiInsights({
    enabled: insightsAvailability === 'active' && isComplete,
    agencyId: ocrAgencyId,
    role,
    language: language === 'ar' ? 'ar' : 'fr',
    metrics: insightsMetrics,
  });
  const rentalsQuery = useRentals();
  const { session } = useSession();

  // Documents expirés (clients et véhicules) : un document « à renouveler bientôt » n'est pas une priorité.
  const expiredDocuments = useMemo(
    () =>
      [...customerDocumentAlerts(customers), ...vehicleDocumentAlerts(vehicles)].filter((alert) => alert.urgency === 'expire').length,
    [customers, vehicles]
  );
  // Disponibilités sur 7 jours : UN SEUL calcul alimente la pastille de l'en-tête, le Parc et le bloc Disponibilités.
  const availability = useMemo(
    () => buildAvailability({ vehicles, rentals: rentalsQuery.data ?? [], maintenance: maintenanceItems, now: new Date() }),
    [vehicles, rentalsQuery.data, maintenanceItems]
  );
  const conflictSummary = useMemo(() => availabilityConflicts(availability), [availability]);
  const priorities = useMemo(
    () =>
      buildPriorities({
        showMoney,
        lateReturns: metrics.activity.lateReturns,
        conflicts: conflictSummary,
        unpaid: metrics.outstanding,
        expiredDocuments,
        overdueMaintenance: metrics.maintenance.overdue,
        stoppedVehicles: metrics.stopped.length,
      }),
    [showMoney, metrics, expiredDocuments, conflictSummary]
  );

  // Briefing du jour : phrase construite par des modèles à partir des mêmes chiffres que les blocs ci-dessous (aucune IA).
  const parc = parcCounts(availability);
  const briefing = useMemo(
    () =>
      buildBriefing(briefingLang, {
        free: freeToday(availability),
        total: parc.total,
        late: metrics.activity.lateReturns,
        insp: availability[0]?.counts.inspectionMaintenance ?? 0,
        conflicts: conflictSummary.count,
        unpaid: metrics.outstanding.count,
        expiredDocs: expiredDocuments,
        showMoney,
      }),
    [briefingLang, availability, parc.total, metrics, conflictSummary, expiredDocuments, showMoney]
  );

  // Premiers pas et bandeaux.
  const gettingStarted = buildGettingStarted({
    role,
    hasLogo: !!agencyDetails.data?.logoUrl,
    vehicleCount: vehicles.length,
    customerCount: customers.length,
    rentalCount: rentalsQuery.data?.length ?? 0,
  });
  const startReady = isComplete && rentalsQuery.isSuccess && (role !== 'owner' || agencyDetails.isSuccess);
  const [startDismissed, dismissStart] = useStoredFlag(dismissKey(session?.user.id, agencyId));
  const [logoDismissed, dismissLogo] = useStoredFlag(agencyId ? `bibip.notice.logo.v1:${agencyId}` : null);
  const [trialDismissed, dismissTrial] = useStoredFlag(agencyId ? `bibip.notice.trial.v1:${agencyId}` : null);
  const logoMissing = role === 'owner' && !!agencyDetails.data && !agencyDetails.data.logoUrl;
  const notice = pickNotice([
    { kind: 'logo', eligible: logoMissing, dismissed: logoDismissed },
    { kind: 'start', eligible: startReady && startDismissed !== null && shouldShowGettingStarted(gettingStarted, startDismissed), dismissed: startDismissed },
    { kind: 'trial', eligible: trialDays !== null, dismissed: trialDismissed },
  ]);
  const nextStep = gettingStarted?.find((step) => !step.done && step.href);
  const noticeText = (kind: NoticeKind): string => {
    if (kind === 'logo') return t('entreprise.logo.homeNoticeTitle');
    if (kind === 'start') {
      const { done, total } = progressOf(gettingStarted ?? []);
      return t('accueil.home.notice.start', { done, total });
    }
    return trialDays !== null && trialDays <= 1 ? t('access.trialLastDay') : t('accueil.home.notice.trial', { count: trialDays ?? 0 });
  };
  const noticeAction: Record<NoticeKind, () => void> = {
    logo: () => router.push('/entreprise'),
    start: () => router.push(nextStep?.href ?? '/bienvenue'),
    trial: () => router.push('/profil'),
  };
  const noticeDismiss: Record<NoticeKind, () => Promise<void>> = { logo: dismissLogo, start: dismissStart, trial: dismissTrial };

  // Toute première arrivée dans une agence encore vide : parcours de bienvenue plein écran (une seule fois).
  const [welcomeSeen] = useStoredFlag(welcomeSeenKey(session?.user.id, agencyId));
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
  if (!agencyQuery.data) return <Redirect href="/onboarding" />;

  const fullName = profileQuery.data?.nomComplet ?? agencyQuery.data.memberName;
  const prenom = headerFirstName(profileQuery.data?.prenom, fullName);
  const aiTime =
    insights.data?.at != null
      ? new Date(insights.data.at).toLocaleTimeString(language === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })
      : null;
  const openFocus = (focus: RentalFocus) => router.push({ pathname: '/locations', params: { focus, period } });

  return (
    <ThemedView className="flex-1">
      {/* Fond graphite derrière la barre d'état : ses icônes claires restent lisibles même quand l'en-tête a défilé. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, start: 0, end: 0, height: insets.top, backgroundColor: Brand.graphite, zIndex: 10 }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabInset }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetchAll} tintColor={Brand.white} colors={[Palette.primary]} progressViewOffset={insets.top} />}
      >
        <HomeHeader
          prenom={prenom}
          initials={getInitials(fullName ?? prenom)}
          agencyName={agencyQuery.data.agencyName}
          avatarPath={profileQuery.data?.photoPath}
          availableNow={freeToday(availability)}
          period={period}
          onPeriodChange={setPeriod}
          metrics={metrics}
          showMoney={showMoney}
          loading={isLoading}
          onOpenProfile={() => setMenuOpen(true)}
          onOpenFocus={openFocus}
        />

        <AskBibip
          chatActive={chatAvailability === 'active'}
          briefing={briefing}
          lang={briefingLang}
          onLangChange={setBriefingLang}
          updatedAt={updatedAt}
          loading={isLoading}
          error={isError || rentalsQuery.isError}
          onRetry={refetchAll}
        />

        {notice ? (
          <View style={{ marginTop: 12 }}>
            <HomeNotice text={noticeText(notice)} onPress={noticeAction[notice]} onDismiss={() => void noticeDismiss[notice]()} />
          </View>
        ) : null}

        {isLoading ? (
          <View style={{ marginTop: 30, paddingHorizontal: 20, gap: 30 }}>
            <Skeleton height={168} radius={22} />
            <Skeleton height={84} radius={18} />
            <Skeleton height={116} radius={22} />
            <Skeleton height={68} radius={18} />
          </View>
        ) : (
          <View style={{ marginTop: 30, gap: 30 }}>
            <PrioritiesSection priorities={priorities} aiTime={aiTime} />
            <AvailabilitySection days={availability} error={isError || rentalsQuery.isError} onRetry={refetchAll} />
            <ParcSection counts={parcCounts(availability)} occupancyPct={metrics.occupancyPct} />
            <AgendaSection
              rentals={rentalsQuery.data ?? []}
              customers={customers}
              vehicles={vehicles}
              pendingConfirmation={metrics.activity.pendingConfirmation}
              upcoming7Days={metrics.activity.upcoming7Days}
              onOpenFocus={openFocus}
            />
          </View>
        )}
      </ScrollView>
      <ProfileSheet visible={menuOpen} onClose={() => setMenuOpen(false)} name={fullName ?? prenom} agencyName={agencyQuery.data.agencyName} />
    </ThemedView>
  );
}
