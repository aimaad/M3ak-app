import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PickerField } from '@/components/picker-field';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { useCustomers } from '@/features/customers/hooks';
import { searchCustomers } from '@/features/customers/search';
import type { Customer } from '@/features/customers/types';
import { bookedDates, hasBookingConflict } from '@/features/rentals/availability';
import { DateRangeCalendar, type DateRangeValue } from '@/features/rentals/date-range-calendar';
import { useCreateRental, useVehicleRentals } from '@/features/rentals/hooks';
import { isRentalFormValid, validateRentalForm } from '@/features/rentals/validation';
import { DEFAULT_VEHICLE_FILTERS, filterVehicles } from '@/features/vehicles/filters';
import { useVehicles } from '@/features/vehicles/hooks';
import type { Vehicle } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

export default function NouvelleLocationScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const vehiclesQuery = useVehicles();
  const customersQuery = useCustomers();
  const createRental = useCreateRental();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [range, setRange] = useState<DateRangeValue>({ start: null, end: null });
  const [prixTotal, setPrixTotal] = useState('');
  const [cautionMontant, setCautionMontant] = useState('2000');
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const vehicleRentalsQuery = useVehicleRentals(vehicle?.id);
  const disabledDates = useMemo(
    () => bookedDates(vehicleRentalsQuery.data ?? []),
    [vehicleRentalsQuery.data]
  );

  const conflict =
    !!range.start &&
    !!range.end &&
    hasBookingConflict(vehicleRentalsQuery.data ?? [], { start: range.start, end: range.end });

  const errors = validateRentalForm(
    {
      vehicleId: vehicle?.id ?? '',
      customerId: customer?.id ?? '',
      dateDebutPrevue: range.start ?? '',
      dateFinPrevue: range.end ?? '',
      prixTotal,
      cautionMontant,
    },
    conflict
  );
  const showErrors = touched;

  async function handleSubmit() {
    setTouched(true);
    setSubmitError(null);
    if (!isRentalFormValid(errors) || !agencyQuery.data || !vehicle || !customer || !range.start || !range.end) {
      return;
    }

    try {
      const rental = await createRental.mutateAsync({
        agencyId: agencyQuery.data.agencyId,
        input: {
          vehicleId: vehicle.id,
          customerId: customer.id,
          dateDebutPrevue: range.start,
          dateFinPrevue: range.end,
          prixTotal: prixTotal.trim() ? Number(prixTotal) : null,
          cautionMontant: Number(cautionMontant),
        },
      });
      router.replace(`/locations/${rental.id}`);
    } catch {
      setSubmitError(t('locations.form.createError'));
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('locations.form.newTitle')} showBack />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
          <PickerField
            label={t('locations.vehicle')}
            placeholder={t('locations.form.vehiclePlaceholder')}
            searchPlaceholder={t('locations.form.vehicleSearch')}
            items={vehiclesQuery.data ?? []}
            selectedItem={vehicle}
            getId={(v) => v.id}
            getLabel={(v) => `${v.marque} ${v.modele}`}
            getSubLabel={(v) => v.immatriculation}
            filterItems={(items, query) =>
              filterVehicles(items, { ...DEFAULT_VEHICLE_FILTERS, query })
            }
            onSelect={(v) => {
              setVehicle(v);
              setRange({ start: null, end: null });
            }}
            error={showErrors && errors.vehicleId ? t(`locations.form.errors.${errors.vehicleId}`) : undefined}
          />

          <PickerField
            label={t('locations.customer')}
            placeholder={t('locations.form.customerPlaceholder')}
            searchPlaceholder={t('locations.form.customerSearch')}
            items={customersQuery.data ?? []}
            selectedItem={customer}
            getId={(c) => c.id}
            getLabel={(c) => c.nomComplet}
            getSubLabel={(c) => c.telephone ?? undefined}
            filterItems={searchCustomers}
            onSelect={setCustomer}
            error={showErrors && errors.customerId ? t(`locations.form.errors.${errors.customerId}`) : undefined}
          />

          {vehicle ? (
            <View className="gap-1.5">
              <ThemedText type="small" themeColor="textSecondary">
                {t('locations.period')}
              </ThemedText>
              <DateRangeCalendar disabledDates={disabledDates} value={range} onChange={setRange} />
              {showErrors && errors.dates ? (
                <ThemedText type="small" style={{ color: '#dc2626' }}>
                  {t(`locations.form.errors.${errors.dates}`)}
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          <TextField
            label={t('locations.prixTotal')}
            value={prixTotal}
            onChangeText={setPrixTotal}
            keyboardType="number-pad"
            error={showErrors && errors.prixTotal ? t(`locations.form.errors.${errors.prixTotal}`) : undefined}
          />
          <TextField
            label={t('locations.cautionBlocked')}
            value={cautionMontant}
            onChangeText={setCautionMontant}
            keyboardType="number-pad"
            error={
              showErrors && errors.cautionMontant
                ? t(`locations.form.errors.${errors.cautionMontant}`)
                : undefined
            }
          />

          {submitError ? (
            <ThemedText type="small" style={{ color: '#dc2626' }}>
              {submitError}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={createRental.isPending}
            className={`mt-2 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
              createRental.isPending ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
            }`}
          >
            {createRental.isPending ? <ActivityIndicator color="#ffffff" /> : null}
            <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
              {createRental.isPending ? t('locations.form.saving') : t('locations.form.save')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
