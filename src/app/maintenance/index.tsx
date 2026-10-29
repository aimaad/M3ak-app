import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMaintenanceItems } from '@/features/maintenance/hooks';
import { MaintenanceRow } from '@/features/maintenance/maintenance-row';
import { useVehicles } from '@/features/vehicles/hooks';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';
import { M3akPalette } from '@/constants/theme';

export default function MaintenanceScreen() {
  const { t, language } = useLanguage();
  const fabSideClass = isRTL(language) ? 'left-6' : 'right-6';
  const maintenanceQuery = useMaintenanceItems();
  const vehiclesQuery = useVehicles();

  const vehicles = vehiclesQuery.data ?? [];

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('maintenance.title')} showBack />

        {maintenanceQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
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
                onRefresh={() => void maintenanceQuery.refetch()}
                tintColor={M3akPalette.mauve}
              />
            }
            renderItem={({ item }) => {
              const vehicle = vehicles.find((v) => v.id === item.vehicleId);
              return (
                <MaintenanceRow
                  item={item}
                  vehicleLabel={vehicle ? `${vehicle.marque} ${vehicle.modele}` : undefined}
                  currentKm={vehicle?.kilometrage ?? null}
                  onPress={() => router.push(`/maintenance/${item.id}`)}
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
          className={`absolute bottom-6 ${fabSideClass} flex-row items-center gap-2 rounded-full bg-brand px-5 py-4`}
        >
          <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
            {`+ ${t('maintenance.addAction')}`}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}
