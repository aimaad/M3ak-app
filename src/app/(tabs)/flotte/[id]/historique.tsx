import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/form/button';
import { Palette } from '@/constants/theme';
import { useVehicleCompliance } from '@/features/compliance/hooks';
import { useVehicleInspections } from '@/features/inspections/hooks';
import { buildHistory, type HistoryEvent } from '@/features/vehicles/detail/history';
import { HistoryList } from '@/features/vehicles/detail/sections-view';
import { useVehicleDetail } from '@/features/vehicles/detail/use-vehicle-detail';
import { canSeePrices } from '@/features/vehicles/fleet-card';
import { useLanguage } from '@/i18n/use-language';

/** Pas de la pagination : 15 événements à la fois (« Afficher plus » pour la suite). */
export const HISTORY_PAGE_SIZE = 15;

/** « Tout voir » : la même liste que l'historique de la fiche, 15 événements par page. */
export default function VehicleHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const detail = useVehicleDetail(id);
  const inspectionsQuery = useVehicleInspections(id);
  const complianceQuery = useVehicleCompliance(id);
  const showAmounts = canSeePrices(detail.role);
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const events = useMemo(
    () => buildHistory({ rentals: detail.rentals, inspections: inspectionsQuery.data ?? [], maintenance: detail.maintenance, compliance: complianceQuery.data ?? [], customers: detail.customers, showAmounts }),
    [detail.rentals, inspectionsQuery.data, detail.maintenance, complianceQuery.data, detail.customers, showAmounts]
  );

  function open(event: HistoryEvent) {
    if (event.kind === 'compliance') return;
    if (event.kind === 'maintenance') router.push({ pathname: '/maintenance/[id]', params: { id: event.maintenanceId } });
    else router.push({ pathname: '/locations/[id]', params: { id: event.rentalId } });
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('vehicleDetail.history.screenTitle')} showBack />
        {detail.isLoading || inspectionsQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={Palette.primary} />
          </View>
        ) : events.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('vehicleDetail.history.empty')}
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerClassName="px-6 pb-10 pt-4 gap-4">
            <HistoryList events={events.slice(0, visibleCount)} onOpen={open} />
            <ThemedText type="small" themeColor="textSecondary" className="text-center">
              {t('vehicleDetail.history.shown', { shown: Math.min(visibleCount, events.length), total: events.length })}
            </ThemedText>
            {visibleCount < events.length ? (
              <Button variant="secondary" label={t('vehicleDetail.history.more', { count: Math.min(HISTORY_PAGE_SIZE, events.length - visibleCount) })} onPress={() => setVisibleCount((value) => value + HISTORY_PAGE_SIZE)} />
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
