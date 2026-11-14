import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/theme';
import { useVehicleCompliance } from '@/features/compliance/hooks';
import { useVehicleInspections } from '@/features/inspections/hooks';
import { buildHistory, type HistoryEvent } from '@/features/vehicles/detail/history';
import { HistoryList } from '@/features/vehicles/detail/sections-view';
import { useVehicleDetail } from '@/features/vehicles/detail/use-vehicle-detail';
import { canSeePrices } from '@/features/vehicles/fleet-card';
import { useLanguage } from '@/i18n/use-language';

/** « Tout voir » : la même liste que l'historique de la fiche, sans limite. */
export default function VehicleHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const detail = useVehicleDetail(id);
  const inspectionsQuery = useVehicleInspections(id);
  const complianceQuery = useVehicleCompliance(id);
  const showAmounts = canSeePrices(detail.role);
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
          <ScrollView contentContainerClassName="px-6 pb-10 pt-4">
            <HistoryList events={events} onOpen={open} />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
