import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
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

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function CalendrierScreen() {
  const { t } = useLanguage();
  const rentalsQuery = useRentals();
  const vehiclesQuery = useVehicles();
  const customersQuery = useCustomers();

  const [statusFilter, setStatusFilter] = useState<RentalStatusFilter>('tous');
  const [vehicleFilter, setVehicleFilter] = useState<string | 'tous'>('tous');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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

  const daysWithBookings = useMemo(() => {
    const map = new Map<string, Rental[]>();
    for (const rental of filteredRentals) {
      for (const day of eachDayInRange(rental.dateDebutPrevue, rental.dateFinPrevue)) {
        const list = map.get(day) ?? [];
        list.push(rental);
        map.set(day, list);
      }
    }
    return map;
  }, [filteredRentals]);

  const markedDates = useMemo(() => {
    const marks: Record<string, object> = {};
    for (const day of daysWithBookings.keys()) {
      marks[day] = { marked: true, dotColor: '#7C3AED', selected: day === selectedDay, selectedColor: '#EDE9FE' };
    }
    if (selectedDay && !marks[selectedDay]) {
      marks[selectedDay] = { selected: true, selectedColor: '#EDE9FE' };
    }
    return marks;
  }, [daysWithBookings, selectedDay]);

  const visibleRentals = useMemo(() => {
    const list = selectedDay ? (daysWithBookings.get(selectedDay) ?? []) : filteredRentals;
    return [...list].sort((a, b) => a.dateDebutPrevue.localeCompare(b.dateDebutPrevue));
  }, [selectedDay, daysWithBookings, filteredRentals]);

  const isLoading = rentalsQuery.isLoading || vehiclesQuery.isLoading || customersQuery.isLoading;

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
                  statusFilter === status ? 'border-[#211A2E] bg-[#211A2E]' : 'border-[#EAE5F2] bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: statusFilter === status ? '#ffffff' : '#211A2E' }}>
                  {t(`locations.status.${status}`)}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            <Pressable
              onPress={() => setVehicleFilter('tous')}
              className={`rounded-full border px-4 py-2 ${
                vehicleFilter === 'tous' ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'
              }`}
            >
              <ThemedText type="small" style={{ color: vehicleFilter === 'tous' ? '#ffffff' : '#211A2E' }}>
                {t('locations.calendar.allVehicles')}
              </ThemedText>
            </Pressable>
            {(vehiclesQuery.data ?? []).map((v) => (
              <Pressable
                key={v.id}
                onPress={() => setVehicleFilter(v.id)}
                className={`rounded-full border px-4 py-2 ${
                  vehicleFilter === v.id ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: vehicleFilter === v.id ? '#ffffff' : '#211A2E' }}>
                  {v.immatriculation}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#7C3AED" />
          </View>
        ) : (
          <View className="flex-1">
            <Calendar
              markedDates={markedDates}
              onDayPress={(day: DateData) => setSelectedDay((prev) => (prev === day.dateString ? null : day.dateString))}
              theme={{ todayTextColor: '#7C3AED', arrowColor: '#7C3AED', dotColor: '#7C3AED' }}
              style={{ borderBottomWidth: 1, borderBottomColor: '#EAE5F2' }}
            />

            {selectedDay ? (
              <Pressable onPress={() => setSelectedDay(null)} className="px-6 py-2">
                <ThemedText type="small" themeColor="primary">
                  {`${formatDay(selectedDay)} · ${t('locations.calendar.viewList')}`}
                </ThemedText>
              </Pressable>
            ) : null}

            <FlatList
              data={visibleRentals}
              keyExtractor={(item) => item.id}
              contentContainerClassName="gap-3 px-6 pb-10 pt-3"
              renderItem={({ item }) => {
                const vehicle = vehiclesById.get(item.vehicleId);
                const customer = customersById.get(item.customerId);
                const label = `${vehicle ? `${vehicle.marque} ${vehicle.modele}` : t('locations.unknownVehicle')} · ${
                  customer?.nomComplet ?? t('locations.unknownCustomer')
                }`;
                return (
                  <Pressable
                    onPress={() => router.push(`/locations/${item.id}`)}
                    className="gap-1 rounded-2xl border border-[#EAE5F2] bg-white p-3"
                  >
                    <View className="flex-row items-center justify-between">
                      <ThemedText type="smallBold">{label}</ThemedText>
                      <RentalStatusBadge status={item.statut} />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.numero} · {formatDay(item.dateDebutPrevue)} → {formatDay(item.dateFinPrevue)}
                    </ThemedText>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View className="items-center pt-12">
                  <ThemedText type="default" themeColor="textSecondary">
                    {t('locations.calendar.empty')}
                  </ThemedText>
                </View>
              }
            />
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
