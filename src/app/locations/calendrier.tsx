import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Agenda, type AgendaEntry, type AgendaSchedule } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCustomers } from '@/features/customers/hooks';
import type { Customer } from '@/features/customers/types';
import { RENTAL_STATUS_FILTERS, type RentalStatusFilter } from '@/features/rentals/filters';
import { useRentals } from '@/features/rentals/hooks';
import { RentalStatusBadge } from '@/features/rentals/rental-status-badge';
import type { Rental } from '@/features/rentals/types';
import { useVehicles } from '@/features/vehicles/hooks';
import type { Vehicle } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

// Pas de texte traduit à l'intérieur : "name" n'est utilisé que comme clé
// stable par react-native-calendars. L'affichage réel (marque/modèle/
// client traduits) se construit dans renderItem, pas ici — sinon la
// référence de "items" change à chaque rendu (la fonction t() de
// react-i18next n'est pas stable) et Agenda boucle indéfiniment
// ("Maximum update depth exceeded").
type RentalEntry = AgendaEntry & { rental: Rental };

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function eachDayInRange(startISO: string, endISO: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${toDateKey(startISO)}T00:00:00Z`);
  const end = new Date(`${toDateKey(endISO)}T00:00:00Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export default function CalendrierScreen() {
  const { t } = useLanguage();
  const rentalsQuery = useRentals();
  const vehiclesQuery = useVehicles();
  const customersQuery = useCustomers();

  const [statusFilter, setStatusFilter] = useState<RentalStatusFilter>('tous');
  const [vehicleFilter, setVehicleFilter] = useState<string | 'tous'>('tous');

  const vehiclesById = useMemo(() => {
    const map = new Map<string, Vehicle>();
    for (const v of vehiclesQuery.data ?? []) map.set(v.id, v);
    return map;
  }, [vehiclesQuery.data]);

  const customersById = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customersQuery.data ?? []) map.set(c.id, c);
    return map;
  }, [customersQuery.data]);

  const filteredRentals = useMemo(() => {
    return (rentalsQuery.data ?? []).filter((r) => {
      if (statusFilter !== 'tous' && r.statut !== statusFilter) return false;
      if (vehicleFilter !== 'tous' && r.vehicleId !== vehicleFilter) return false;
      return true;
    });
  }, [rentalsQuery.data, statusFilter, vehicleFilter]);

  const items: AgendaSchedule = useMemo(() => {
    const schedule: Record<string, RentalEntry[]> = {};
    for (const rental of filteredRentals) {
      for (const day of eachDayInRange(rental.dateDebutPrevue, rental.dateFinPrevue)) {
        const entry: RentalEntry = { name: rental.numero, height: 72, day, rental };
        schedule[day] = [...(schedule[day] ?? []), entry];
      }
    }
    return schedule;
  }, [filteredRentals]);

  const markedDates = useMemo(() => {
    const marks: Record<string, object> = {};
    for (const day of Object.keys(items)) {
      marks[day] = { marked: true, dotColor: '#1f5eff' };
    }
    return marks;
  }, [items]);

  const isLoading = rentalsQuery.isLoading || vehiclesQuery.isLoading || customersQuery.isLoading;

  const renderItem = useCallback(
    (item: AgendaEntry) => {
      const entry = item as RentalEntry;
      const vehicle = vehiclesById.get(entry.rental.vehicleId);
      const customer = customersById.get(entry.rental.customerId);
      const label = `${vehicle ? `${vehicle.marque} ${vehicle.modele}` : t('locations.unknownVehicle')} · ${
        customer?.nomComplet ?? t('locations.unknownCustomer')
      }`;
      return (
        <Pressable
          onPress={() => router.push(`/locations/${entry.rental.id}`)}
          className="mx-4 mt-2 gap-1 rounded-2xl border border-[#e1e5f0] bg-white p-3"
        >
          <View className="flex-row items-center justify-between">
            <ThemedText type="smallBold">{label}</ThemedText>
            <RentalStatusBadge status={entry.rental.statut} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {entry.rental.numero}
          </ThemedText>
        </Pressable>
      );
    },
    [vehiclesById, customersById, t]
  );

  const renderEmptyData = useCallback(
    () => (
      <View className="items-center pt-12">
        <ThemedText type="default" themeColor="textSecondary">
          {t('locations.calendar.empty')}
        </ThemedText>
      </View>
    ),
    [t]
  );

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={t('locations.calendar.title')}
          showBack
          right={
            <Pressable onPress={() => router.push('/locations')} hitSlop={8}>
              <ThemedText type="small" themeColor="primary">
                {t('locations.calendar.viewList')}
              </ThemedText>
            </Pressable>
          }
        />

        <View className="gap-2 px-6 pb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {RENTAL_STATUS_FILTERS.filter((s) => s !== 'reservee').map((status) => (
              <Pressable
                key={status}
                onPress={() => setStatusFilter(status)}
                className={`rounded-full border px-4 py-2 ${
                  statusFilter === status ? 'border-[#101423] bg-[#101423]' : 'border-[#e1e5f0] bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: statusFilter === status ? '#ffffff' : '#101423' }}>
                  {t(`locations.status.${status}`)}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            <Pressable
              onPress={() => setVehicleFilter('tous')}
              className={`rounded-full border px-4 py-2 ${
                vehicleFilter === 'tous' ? 'border-[#1f5eff] bg-[#1f5eff]' : 'border-[#e1e5f0] bg-white'
              }`}
            >
              <ThemedText type="small" style={{ color: vehicleFilter === 'tous' ? '#ffffff' : '#101423' }}>
                {t('locations.calendar.allVehicles')}
              </ThemedText>
            </Pressable>
            {(vehiclesQuery.data ?? []).map((v) => (
              <Pressable
                key={v.id}
                onPress={() => setVehicleFilter(v.id)}
                className={`rounded-full border px-4 py-2 ${
                  vehicleFilter === v.id ? 'border-[#1f5eff] bg-[#1f5eff]' : 'border-[#e1e5f0] bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: vehicleFilter === v.id ? '#ffffff' : '#101423' }}>
                  {v.immatriculation}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1f5eff" />
          </View>
        ) : (
          <Agenda
            items={items}
            markedDates={markedDates}
            renderItem={renderItem}
            renderEmptyData={renderEmptyData}
            theme={{ todayTextColor: '#1f5eff', selectedDayBackgroundColor: '#1f5eff', dotColor: '#1f5eff' }}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
