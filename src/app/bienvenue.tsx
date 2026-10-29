import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useAgencyDetails, useMyAgency } from '@/features/agency/hooks';
import { useSession } from '@/features/auth/session-context';
import { useCustomers } from '@/features/customers/hooks';
import { buildGettingStarted, type StartStepKey } from '@/features/onboarding/getting-started';
import { useStoredFlag } from '@/features/onboarding/use-stored-flag';
import { currentWelcomeScreen, welcomeSeenKey } from '@/features/onboarding/welcome-flow';
import { useRentals } from '@/features/rentals/hooks';
import { useVehicles } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

const ICONS: Record<StartStepKey | 'intro' | 'done', keyof typeof Ionicons.glyphMap> = {
  intro: 'sparkles',
  done: 'checkmark-circle',
  joined: 'checkmark-circle',
  logo: 'image-outline',
  vehicle: 'car-sport-outline',
  customer: 'person-add-outline',
  rental: 'calendar-outline',
};

/**
 * Parcours de bienvenue plein écran : une étape par écran, à l'arrivée du propriétaire dans son agence. Les étapes se
 * cochent toutes seules (les données se rafraîchissent au retour d'un formulaire) ; chacune peut être passée.
 */
export default function BienvenueScreen() {
  const { t } = useLanguage();
  const { session } = useSession();
  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const role = agencyQuery.data?.role;
  const details = useAgencyDetails(role === 'owner' ? agencyId : undefined);
  const vehiclesQuery = useVehicles();
  const customersQuery = useCustomers();
  const rentalsQuery = useRentals();
  const [, markSeen] = useStoredFlag(welcomeSeenKey(session?.user.id, agencyId));
  const [started, setStarted] = useState(false);
  const [skipped, setSkipped] = useState<StartStepKey[]>([]);

  const steps = buildGettingStarted({
    role,
    hasLogo: !!details.data?.logoUrl,
    vehicleCount: vehiclesQuery.data?.length ?? 0,
    customerCount: customersQuery.data?.length ?? 0,
    rentalCount: rentalsQuery.data?.length ?? 0,
  });
  const ready = agencyQuery.isSuccess && vehiclesQuery.isSuccess && customersQuery.isSuccess && rentalsQuery.isSuccess && (role !== 'owner' || details.isSuccess);

  async function leave() {
    await markSeen();
    router.replace('/accueil');
  }

  if (agencyQuery.isSuccess && !agencyQuery.data) return <Redirect href="/onboarding" />;
  if (agencyQuery.isSuccess && !steps) return <Redirect href="/accueil" />;

  const screen = ready ? currentWelcomeScreen(steps, started, skipped) : null;

  return (
    <View className="flex-1" style={{ backgroundColor: M3akPalette.mauveDeep }}>
      <SafeAreaView className="flex-1">
        <View className="flex-1 px-6">
        <View className="min-h-11 flex-row items-center justify-between">
          {screen?.kind === 'step' ? (
            <ThemedText type="small" style={{ color: '#FFFFFF', opacity: 0.85 }} accessibilityLiveRegion="polite">
              {t('onboarding.welcome.stepOf', { current: screen.position, total: screen.total })}
            </ThemedText>
          ) : (
            <View />
          )}
          {screen && screen.kind !== 'done' ? (
            <Pressable onPress={() => void leave()} hitSlop={10} accessibilityRole="button" className="min-h-11 justify-center">
              <ThemedText type="smallBold" style={{ color: '#FFFFFF', opacity: 0.85 }}>
                {t('onboarding.welcome.later')}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {!screen ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : (
          <>
            <View className="flex-1 items-center justify-center gap-6">
              <View className="h-28 w-28 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}>
                <Ionicons name={ICONS[screen.kind === 'step' ? screen.step.key : screen.kind]} size={56} color="#FFFFFF" />
              </View>

              {screen.kind === 'step' ? (
                <View className="items-center gap-3 px-2">
                  <ThemedText type="subtitle" style={{ color: '#FFFFFF', textAlign: 'center' }} accessibilityRole="header">
                    {t(`onboarding.welcome.steps.${screen.step.key}.title`)}
                  </ThemedText>
                  <ThemedText style={{ color: '#FFFFFF', opacity: 0.9, textAlign: 'center' }}>
                    {t(`onboarding.welcome.steps.${screen.step.key}.hint`)}
                  </ThemedText>
                </View>
              ) : (
                <View className="items-center gap-3 px-2">
                  <ThemedText type="subtitle" style={{ color: '#FFFFFF', textAlign: 'center' }} accessibilityRole="header">
                    {screen.kind === 'intro' ? t('onboarding.welcome.introTitle') : t('onboarding.welcome.doneTitle')}
                  </ThemedText>
                  <ThemedText style={{ color: '#FFFFFF', opacity: 0.9, textAlign: 'center' }}>
                    {screen.kind === 'intro'
                      ? t('onboarding.welcome.introBody', { agency: agencyQuery.data?.agencyName ?? '', count: screen.total })
                      : screen.skipped > 0
                        ? t('onboarding.welcome.doneBodySkipped')
                        : t('onboarding.welcome.doneBody')}
                  </ThemedText>
                </View>
              )}
            </View>

            <View className="gap-2 pb-4">
              <Pressable
                onPress={() => {
                  if (screen.kind === 'intro') setStarted(true);
                  else if (screen.kind === 'step' && screen.step.href) router.push(screen.step.href);
                  else void leave();
                }}
                accessibilityRole="button"
                className="min-h-14 items-center justify-center rounded-2xl bg-white px-4"
              >
                <ThemedText type="smallBold" style={{ color: M3akPalette.mauveDeep }}>
                  {screen.kind === 'intro'
                    ? t('onboarding.welcome.start')
                    : screen.kind === 'step'
                      ? t(`onboarding.welcome.steps.${screen.step.key}.action`)
                      : t('onboarding.welcome.goHome')}
                </ThemedText>
              </Pressable>
              {screen.kind === 'step' ? (
                <Pressable
                  onPress={() => setSkipped((current) => [...current, screen.step.key])}
                  accessibilityRole="button"
                  className="min-h-12 items-center justify-center"
                >
                  <ThemedText type="smallBold" style={{ color: '#FFFFFF', opacity: 0.85 }}>
                    {t('onboarding.welcome.skipStep')}
                  </ThemedText>
                </Pressable>
              ) : (
                <View className="min-h-12" />
              )}
            </View>
          </>
        )}
        </View>
      </SafeAreaView>
    </View>
  );
}
