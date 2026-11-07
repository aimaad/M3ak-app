import { router } from 'expo-router';
import { View } from 'react-native';

import { PressableCard } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useDashboardMetrics } from '@/features/dashboard/hooks';
import { usePersistedPeriod } from '@/features/dashboard/use-persisted-period';
import { useVehicles } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

import { HomeListScreen } from '@/features/dashboard/home-list-screen';

/** Véhicules sans aucune location sur la période choisie à l'accueil. */
export default function StoppedVehiclesScreen() {
  const { t } = useLanguage();
  const [period] = usePersistedPeriod();
  const { metrics, isLoading } = useDashboardMetrics(period);
  const vehicles = useVehicles();

  return (
    <HomeListScreen
      title={t('accueil.home.lists.stopped.title')}
      subtitle={`${t('accueil.home.lists.stopped.subtitle')} · ${t(`accueil.home.stats.${period}`)}`}
      data={metrics.stopped}
      loading={isLoading}
      emptyLabel={t('accueil.home.lists.stopped.empty')}
      keyOf={(item) => item.vehicleId}
      renderItem={(item) => {
        const vehicle = vehicles.data?.find((v) => v.id === item.vehicleId);
        return (
          <PressableCard onPress={() => router.push({ pathname: '/flotte/[id]', params: { id: item.vehicleId } })} className="gap-0.5">
            <ThemedText type="smallBold">{item.label}</ThemedText>
            {vehicle ? (
              <View>
                <ThemedText type="small" themeColor="textSecondary">
                  {vehicle.immatriculation}
                </ThemedText>
              </View>
            ) : null}
          </PressableCard>
        );
      }}
    />
  );
}
