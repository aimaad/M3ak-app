import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette, Shadows } from '@/constants/theme';
import { useCustomers } from '@/features/customers/hooks';
import type { Customer } from '@/features/customers/types';
import { RENTAL_STATUS_FILTERS, type RentalStatusFilter } from '@/features/rentals/filters';
import { useRentals } from '@/features/rentals/hooks';
import { setCalendarLocale } from '@/features/rentals/calendar-locale';
import { overlappingRentalIds } from '@/features/rentals/availability';
import { OverlapBadge } from '@/features/rentals/overlap-badge';
import { CALENDAR_THEME } from '@/features/rentals/calendar-theme';
import { RENTAL_STATUS_STYLES, RentalStatusBadge } from '@/features/rentals/rental-status-badge';
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
  const { t, language } = useLanguage();
  setCalendarLocale(language);
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

  const overlapping = useMemo(() => overlappingRentalIds(rentalsQuery.data ?? []), [rentalsQuery.data]);

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
    for (const [day, rentals] of daysWithBookings.entries()) {
      // Un point par statut présent ce jour-là (3 au plus), de la couleur du statut.
      const statuses = [...new Set(rentals.map((rental) => rental.statut))].slice(0, 3);
      marks[day] = {
        dots: statuses.map((status) => ({ key: status, color: RENTAL_STATUS_STYLES[status].dot })),
        selected: day === selectedDay,
        selectedColor: M3akPalette.mauve,
      };
    }
    if (selectedDay && !marks[selectedDay]) {
      marks[selectedDay] = { selected: true, selectedColor: M3akPalette.mauve };
    }
    return marks;
  }, [daysWithBookings, selectedDay]);

  const legendStatuses = useMemo(
    () => RENTAL_STATUS_FILTERS.filter((status): status is Exclude<RentalStatusFilter, 'tous' | 'reservee'> => status !== 'tous' && status !== 'reservee'),
    []
  );

  const visibleRentals = useMemo(() => {
    const list = selectedDay ? (daysWithBookings.get(selectedDay) ?? []) : filteredRentals;
    return [...list].sort((a, b) => a.dateDebutPrevue.localeCompare(b.dateDebutPrevue));
  }, [selectedDay, daysWithBookings, filteredRentals]);

  const isLoading = rentalsQuery.isLoading || vehiclesQuery.isLoading || customersQuery.isLoading;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
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
          <ScrollView horizontal className="grow-0 shrink-0" showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {RENTAL_STATUS_FILTERS.filter((s) => s !== 'reservee').map((status) => (
              <Pressable
                key={status}
                onPress={() => setStatusFilter(status)}
                className={`rounded-full border px-4 py-2 ${
                  statusFilter === status ? 'border-brand bg-brand' : 'border-line bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: statusFilter === status ? '#FFFFFF' : M3akPalette.ink }}>
                  {t(`locations.status.${status}`)}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal className="grow-0 shrink-0" showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            <Pressable
              onPress={() => setVehicleFilter('tous')}
              className={`rounded-full border px-4 py-2 ${
                vehicleFilter === 'tous' ? 'border-brand bg-brand' : 'border-line bg-white'
              }`}
            >
              <ThemedText type="small" style={{ color: vehicleFilter === 'tous' ? '#FFFFFF' : M3akPalette.ink }}>
                {t('locations.calendar.allVehicles')}
              </ThemedText>
            </Pressable>
            {(vehiclesQuery.data ?? []).map((v) => (
              <Pressable
                key={v.id}
                onPress={() => setVehicleFilter(v.id)}
                className={`rounded-full border px-4 py-2 ${
                  vehicleFilter === v.id ? 'border-brand bg-brand' : 'border-line bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: vehicleFilter === v.id ? '#FFFFFF' : M3akPalette.ink }}>
                  {v.immatriculation}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : (
          <View className="flex-1">
            <Card padded={false} className="mx-6 overflow-hidden pb-2">
              <Calendar
                key={language}
                firstDay={1}
                markingType="multi-dot"
                markedDates={markedDates}
                onDayPress={(day: DateData) => setSelectedDay((prev) => (prev === day.dateString ? null : day.dateString))}
                enableSwipeMonths
                theme={CALENDAR_THEME}
              />
              <View className="flex-row flex-wrap gap-x-4 gap-y-2 px-4 pt-3">
                {legendStatuses.map((status) => (
                  <View key={status} className="flex-row items-center gap-1.5">
                    <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RENTAL_STATUS_STYLES[status].dot }} />
                    <ThemedText type="small" style={{ color: M3akPalette.muted, fontSize: 12 }}>
                      {t(`locations.status.${status}`)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </Card>

            {selectedDay ? (
              <Pressable onPress={() => setSelectedDay(null)} className="min-h-11 justify-center px-6">
                <ThemedText type="smallBold" themeColor="primary">
                  {`${formatDay(selectedDay)} · ${t('locations.calendar.viewList')}`}
                </ThemedText>
              </Pressable>
            ) : null}

            <FlatList
              data={visibleRentals}
              keyExtractor={(item) => item.id}
              contentContainerClassName="gap-3 px-6 pb-10 pt-4"
              renderItem={({ item }) => {
                const vehicle = vehiclesById.get(item.vehicleId);
                const customer = customersById.get(item.customerId);
                const label = `${vehicle ? `${vehicle.marque} ${vehicle.modele}` : t('locations.unknownVehicle')} · ${
                  customer?.nomComplet ?? t('locations.unknownCustomer')
                }`;
                return (
                  <Pressable
                    onPress={() => router.push(`/locations/${item.id}`)}
                    className="flex-row overflow-hidden rounded-2xl border border-line bg-white"
                    style={Shadows.card}
                  >
                    <View style={{ width: 5, backgroundColor: RENTAL_STATUS_STYLES[item.statut].dot }} />
                    <View className="flex-1 gap-2 p-4">
                      <View className="flex-row items-start justify-between gap-2">
                        <ThemedText type="smallBold" className="flex-1">
                          {label}
                        </ThemedText>
                        <RentalStatusBadge status={item.statut} />
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.numero} · {formatDay(item.dateDebutPrevue)} → {formatDay(item.dateFinPrevue)}
                      </ThemedText>
                      {overlapping.has(item.id) ? <OverlapBadge /> : null}
                    </View>
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
