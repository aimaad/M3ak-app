import { router } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMarkMaintenanceDone, useMaintenanceItems } from '@/features/maintenance/hooks';
import { MaintenanceRow } from '@/features/maintenance/maintenance-row';
import { useVehicles } from '@/features/vehicles/hooks';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

export default function MaintenanceScreen() {
  const { t, language } = useLanguage();
  const fabSideClass = isRTL(language) ? 'left-6' : 'right-6';
  const maintenanceQuery = useMaintenanceItems();
  const vehiclesQuery = useVehicles();
  const markDone = useMarkMaintenanceDone();

  const vehicles = vehiclesQuery.data ?? [];

  function handlePress(itemId: string, isDone: boolean) {
    if (isDone) return;
    Alert.alert(t('maintenance.markDone'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('maintenance.markDone'), onPress: () => markDone.mutate(itemId) },
    ]);
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('maintenance.title')} showBack />

        {maintenanceQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1f5eff" />
          </View>
        ) : maintenanceQuery.isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('maintenance.loadError')}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={maintenanceQuery.data ?? []}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 px-6 pb-28"
            refreshControl={
              <RefreshControl
                refreshing={maintenanceQuery.isFetching}
                onRefresh={() => maintenanceQuery.refetch()}
                tintColor="#1f5eff"
              />
            }
            renderItem={({ item }) => {
              const vehicle = vehicles.find((v) => v.id === item.vehicleId);
              return (
                <MaintenanceRow
                  item={item}
                  vehicleLabel={vehicle ? `${vehicle.marque} ${vehicle.modele}` : undefined}
                  currentKm={vehicle?.kilometrage ?? null}
                  onPress={() => handlePress(item.id, item.statut === 'effectuee')}
                />
              );
            }}
            ListEmptyComponent={
              <View className="items-center pt-12">
                <ThemedText type="default" themeColor="textSecondary">
                  {t('maintenance.empty')}
                </ThemedText>
              </View>
            }
          />
        )}

        <Pressable
          onPress={() => router.push('/maintenance/nouveau')}
          className={`absolute bottom-6 ${fabSideClass} flex-row items-center gap-2 rounded-full bg-[#1f5eff] px-5 py-4`}
        >
          <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
            {`+ ${t('maintenance.addAction')}`}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}
