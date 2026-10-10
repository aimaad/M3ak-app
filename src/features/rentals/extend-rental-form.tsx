import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { bookedDates } from './availability';
import { RENTAL_CONFLICT_ERROR } from './api';
import { useUpdateRentalDates, useVehicleRentals } from './hooks';
import type { Rental } from './types';

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function ExtendRentalForm({ rental }: { rental: Rental }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vehicleRentalsQuery = useVehicleRentals(rental.vehicleId);
  const updateDates = useUpdateRentalDates();

  const disabledDates = useMemo(() => {
    const others = (vehicleRentalsQuery.data ?? []).filter((r) => r.id !== rental.id);
    return bookedDates(others);
  }, [vehicleRentalsQuery.data, rental.id]);

  const minDate = useMemo(() => {
    const next = new Date(`${toDateKey(rental.dateFinPrevue)}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
  }, [rental.dateFinPrevue]);

  async function handleConfirm() {
    if (!selectedDay) return;
    setError(null);
    try {
      await updateDates.mutateAsync({
        id: rental.id,
        vehicleId: rental.vehicleId,
        dateDebutPrevue: rental.dateDebutPrevue,
        dateFinPrevue: `${selectedDay}T${rental.dateFinPrevue.slice(11)}`,
        fraisSupplementaires: rental.fraisSupplementaires,
        remiseMontant: rental.remiseMontant,
      });
      setExpanded(false);
      setSelectedDay(null);
    } catch (err) {
      setError(
        err instanceof Error && err.message === RENTAL_CONFLICT_ERROR
          ? t('locations.form.errors.conflict')
          : t('locations.extend.error')
      );
    }
  }

  if (!expanded) {
    return (
      <Button label={t('locations.extend.action')} variant="secondary" size="sm" onPress={() => setExpanded(true)} />
    );
  }

  const markedDates: Record<string, object> = {};
  for (const date of disabledDates) {
    markedDates[date] = { disabled: true, disableTouchEvent: true, textColor: '#EAE5F2' };
  }
  if (selectedDay) {
    markedDates[selectedDay] = { selected: true, selectedColor: M3akPalette.mauve };
  }

  return (
    <View className="gap-3 rounded-3xl border border-[#EAE5F2] bg-white p-4">
      <ThemedText type="smallBold">{t('locations.extend.title')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('locations.extend.currentEnd', { date: new Date(rental.dateFinPrevue).toLocaleDateString('fr-FR') })}
      </ThemedText>
      <Calendar
        minDate={minDate}
        markedDates={markedDates}
        onDayPress={(day: DateData) => {
          if (disabledDates.includes(day.dateString)) return;
          setSelectedDay(day.dateString);
        }}
        theme={{ todayTextColor: M3akPalette.mauve, arrowColor: M3akPalette.mauve }}
        style={{ borderRadius: 24, overflow: 'hidden' }}
      />
      {error ? (
        <ThemedText type="small" style={{ color: M3akPalette.danger }}>
          {error}
        </ThemedText>
      ) : null}
      <View className="flex-row gap-2">
        <Button
          label={t('common.cancel')}
          variant="secondary"
          size="sm"
          onPress={() => {
            setExpanded(false);
            setSelectedDay(null);
            setError(null);
          }}
          style={{ flex: 1 }}
        />
        <Button
          label={t('locations.extend.confirm')}
          size="sm"
          onPress={handleConfirm}
          disabled={!selectedDay || updateDates.isPending}
          loading={updateDates.isPending}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}
