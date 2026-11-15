import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/form';
import { Palette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { formatAmount, HText } from '@/features/dashboard/home-ui';
import { maintenanceLabel, maintenancePhrase } from '@/features/maintenance/label';
import { useMaintenanceItem, useSnoozeMaintenanceFollowup } from '@/features/maintenance/hooks';
import { QuickDoneCard } from '@/features/vehicles/detail/quick-done-card';
import { displayName } from '@/features/vehicles/detail/names';
import { canSeePrices } from '@/features/vehicles/fleet-card';
import { useVehicle } from '@/features/vehicles/hooks';
import { describeSaveError } from '@/features/vehicles/save-error';
import { useLanguage } from '@/i18n/use-language';

const dayText = (iso: string, language: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Réponse à « Avez-vous fait … ? » (on arrive ici en touchant la notification) : un seul écran, deux gestes.
 *  - « Oui, c'est fait » : kilométrage et date déjà remplis, « Confirmer » (garage et coût facultatifs, jamais bloquants) ;
 *  - « Pas encore » : on choisit quand le rappeler (demain, dans 3 jours, dans une semaine) ; sans réponse, la relance revient le lendemain.
 */
export default function MaintenanceFollowupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useLanguage();
  const agency = useMyAgency();
  const { data: item, isLoading, isError } = useMaintenanceItem(id);
  const { data: vehicle } = useVehicle(item?.vehicleId);
  const snooze = useSnoozeMaintenanceFollowup();
  const [mode, setMode] = useState<'ask' | 'yes' | 'later' | 'snoozed'>('ask');
  const [snoozedWhen, setSnoozedWhen] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const showCost = canSeePrices(agency.data?.role);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/accueil');
  }

  function later(days: number, whenKey: string) {
    if (!item) return;
    setError(null);
    snooze.mutate(
      { id: item.id, days },
      { onSuccess: () => { setSnoozedWhen(t(`maintenanceFollowup.${whenKey}`)); setMode('snoozed'); }, onError: (failure) => setError(describeSaveError(failure, t, 'maintenanceFollowup.failed')) }
    );
  }

  if (isLoading || isError || !item) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('maintenance.title')} showBack />
          <View className="flex-1 items-center justify-center px-8">
            {isLoading ? <ActivityIndicator color={Palette.primary} /> : (
              <ThemedText type="default" themeColor="textSecondary" className="text-center">
                {isError ? t('maintenance.loadError') : t('maintenanceFollowup.notFound')}
              </ThemedText>
            )}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const label = maintenancePhrase(item, t);
  const typeName = maintenanceLabel(item, t);
  const alreadyDone = item.statut === 'effectuee';
  const due = [item.echeanceDate ? t('maintenanceFollowup.dueDate', { date: dayText(item.echeanceDate, language) }) : null, item.echeanceKm != null ? t('maintenanceFollowup.dueKm', { km: formatAmount(item.echeanceKm) }) : null].filter(Boolean).join(t('maintenanceFollowup.or'));

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={typeName} showBack />
        <ScrollView contentContainerStyle={{ gap: 16, paddingHorizontal: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4 }}>
            <HText font="display" weight="bold" size={22} accessibilityRole="header">
              {alreadyDone ? t('maintenanceFollowup.done') : t('maintenanceFollowup.titleQ', { maintenance: label })}
            </HText>
            {vehicle ? (
              <HText size={14} color={Palette.textSecondary}>
                {`${displayName(vehicle)} · ${vehicle.immatriculation}`}
              </HText>
            ) : null}
            {due ? (
              <HText size={13} color={Palette.textSecondary}>
                {t('maintenanceFollowup.due', { when: due })}
              </HText>
            ) : null}
          </View>

          {alreadyDone ? (
            <>
              <HText size={14}>{t('maintenanceFollowup.doneBody')}</HText>
              <Button label={t('maintenanceFollowup.close')} onPress={close} />
            </>
          ) : mode === 'ask' ? (
            <View style={{ gap: 12 }}>
              <HText size={13} color={Palette.textSecondary}>
                {t('maintenanceFollowup.hint')}
              </HText>
              <Button label={t('maintenanceFollowup.yes')} onPress={() => setMode('yes')} accessibilityLabel={t('maintenanceFollowup.yes')} />
              <Button variant="secondary" label={t('maintenanceFollowup.no')} onPress={() => setMode('later')} accessibilityLabel={t('maintenanceFollowup.no')} />
            </View>
          ) : mode === 'yes' && vehicle ? (
            <QuickDoneCard item={item} vehicle={vehicle} now={now} showCost={showCost} onClose={close} />
          ) : mode === 'later' ? (
            <View style={{ gap: 12 }}>
              <HText weight="semibold" size={14}>
                {t('maintenanceFollowup.remind')}
              </HText>
              {error ? (
                <HText size={13} weight="semibold" color={Palette.error} accessibilityRole="alert">
                  {error}
                </HText>
              ) : null}
              <Button variant="secondary" label={t('maintenanceFollowup.tomorrow')} loading={snooze.isPending} onPress={() => later(1, 'whenTomorrow')} />
              <Button variant="secondary" label={t('maintenanceFollowup.in3')} loading={snooze.isPending} onPress={() => later(3, 'when3')} />
              <Button variant="secondary" label={t('maintenanceFollowup.in7')} loading={snooze.isPending} onPress={() => later(7, 'when7')} />
              <Button variant="link" label={t('maintenanceFollowup.back')} onPress={() => setMode('ask')} />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <HText size={15} weight="semibold">
                {t('maintenanceFollowup.snoozed', { when: snoozedWhen })}
              </HText>
              <Button label={t('maintenanceFollowup.close')} onPress={close} />
            </View>
          )}

          {vehicle ? (
            <Button variant="link" label={t('maintenanceFollowup.openVehicle')} onPress={() => router.push({ pathname: '/flotte/[id]', params: { id: vehicle.id } })} />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
