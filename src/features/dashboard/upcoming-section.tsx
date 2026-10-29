import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { PressableCard } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import type { Customer } from '@/features/customers/types';
import { RentalStatusBadge } from '@/features/rentals/rental-status-badge';
import type { Rental } from '@/features/rentals/types';
import type { Vehicle } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

import { SectionTitle } from './kpi-card';
import { upcomingRentals } from './upcoming';

const formatDay = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short' });

/** Prochaines locations (client, voiture, dates, statut) avec lien vers la liste complète. Données déjà chargées par l'écran. */
export function UpcomingRentalsSection({ rentals, customers, vehicles }: { rentals: Rental[]; customers: Customer[]; vehicles: Vehicle[] }) {
  const { t, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';
  const items = upcomingRentals(rentals, new Date(), 3);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <SectionTitle>{t('accueil.upcoming.title')}</SectionTitle>
        <Pressable onPress={() => router.push('/locations')} hitSlop={10} accessibilityRole="link" className="min-h-11 justify-center">
          <ThemedText type="smallBold" style={{ color: M3akPalette.mauve }}>
            {t('accueil.seeAll')}
          </ThemedText>
        </Pressable>
      </View>
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('accueil.upcoming.empty')}
        </ThemedText>
      ) : (
        <View className="gap-2">
          {items.map((rental) => {
            const customer = customers.find((c) => c.id === rental.customerId);
            const vehicle = vehicles.find((v) => v.id === rental.vehicleId);
            return (
              <PressableCard
                key={rental.id}
                onPress={() => router.push({ pathname: '/locations/[id]', params: { id: rental.id } })}
                className="flex-row items-center gap-3"
                accessibilityRole="link"
              >
                <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: M3akPalette.mauveLight }}>
                  <Ionicons name="car-sport-outline" size={22} color={M3akPalette.mauve} />
                </View>
                <View className="flex-1 gap-0.5">
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {customer?.nomComplet ?? t('locations.unknownCustomer')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {vehicle ? `${vehicle.marque} ${vehicle.modele}` : t('locations.unknownVehicle')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                    {formatDay(rental.dateDebutPrevue, locale)} → {formatDay(rental.dateFinPrevue, locale)}
                  </ThemedText>
                </View>
                <RentalStatusBadge status={rental.statut} />
              </PressableCard>
            );
          })}
        </View>
      )}
    </View>
  );
}
