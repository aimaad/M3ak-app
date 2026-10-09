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
import { useCustomers, useDrivers } from '@/features/customers/hooks';
import { searchCustomers } from '@/features/customers/search';
import type { Customer, Driver } from '@/features/customers/types';
import { bookedDates, hasBookingConflict } from '@/features/rentals/availability';
import { DateRangeCalendar, type DateRangeValue } from '@/features/rentals/date-range-calendar';
import { useCreateRental, useVehicleRentals } from '@/features/rentals/hooks';
import { computeRentalPrice } from '@/features/rentals/pricing';
import { RENTAL_CONFLICT_ERROR } from '@/features/rentals/api';
import { isRentalFormValid, validateRentalForm } from '@/features/rentals/validation';
import { DEFAULT_VEHICLE_FILTERS, filterVehicles } from '@/features/vehicles/filters';
import { useVehicles } from '@/features/vehicles/hooks';
import type { Vehicle } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

function toISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export default function NouvelleLocationScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const vehiclesQuery = useVehicles();
  const customersQuery = useCustomers();
  const createRental = useCreateRental();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [range, setRange] = useState<DateRangeValue>({ start: null, end: null });
  const [heureDepart, setHeureDepart] = useState('09:00');
  const [heureRetour, setHeureRetour] = useState('18:00');
  const [lieuDepart, setLieuDepart] = useState('');
  const [lieuRetour, setLieuRetour] = useState('');
  const [fraisSupplementaires, setFraisSupplementaires] = useState('0');
  const [remiseMontant, setRemiseMontant] = useState('0');
  const [acomptePrevu, setAcomptePrevu] = useState('0');
  const [cautionMontant, setCautionMontant] = useState('2000');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittingAs, setSubmittingAs] = useState<'en_attente_confirmation' | 'confirmee' | null>(null);

  const driversQuery = useDrivers(customer?.id);

  const vehicleRentalsQuery = useVehicleRentals(vehicle?.id);
  const disabledDates = useMemo(
    () => bookedDates(vehicleRentalsQuery.data ?? []),
    [vehicleRentalsQuery.data]
  );

  const startISO = range.start ? toISO(range.start, heureDepart) : null;
  const endISO = range.end ? toISO(range.end, heureRetour) : null;

  const conflict =
    !!startISO &&
    !!endISO &&
    hasBookingConflict(vehicleRentalsQuery.data ?? [], { start: startISO, end: endISO });

  const errors = validateRentalForm(
    {
      vehicleId: vehicle?.id ?? '',
      customerId: customer?.id ?? '',
      driverId: driver?.id ?? null,
      dateDebutPrevue: startISO ?? '',
      dateFinPrevue: endISO ?? '',
      lieuDepart,
      lieuRetour,
      fraisSupplementaires,
      remiseMontant,
      acomptePrevu,
      cautionMontant,
      notes,
    },
    conflict
  );
  const showErrors = touched;

  const priceBreakdown = useMemo(() => {
    if (!vehicle || !startISO || !endISO || endISO <= startISO) return null;
    return computeRentalPrice(
      startISO,
      endISO,
      { prixJour: vehicle.prixJour, prixSemaine: vehicle.prixSemaine, prixMois: vehicle.prixMois },
      Number(fraisSupplementaires || '0'),
      Number(remiseMontant || '0')
    );
  }, [vehicle, startISO, endISO, fraisSupplementaires, remiseMontant]);

  async function handleSubmit(statutInitial: 'en_attente_confirmation' | 'confirmee') {
    setTouched(true);
    setSubmitError(null);
    if (!isRentalFormValid(errors) || !agencyQuery.data || !vehicle || !customer || !startISO || !endISO) {
      return;
    }

    setSubmittingAs(statutInitial);
    try {
      const rental = await createRental.mutateAsync({
        agencyId: agencyQuery.data.agencyId,
        input: {
          vehicleId: vehicle.id,
          customerId: customer.id,
          driverId: driver?.id ?? null,
          branchDepartId: null,
          branchRetourId: null,
          lieuDepart: lieuDepart.trim() || null,
          lieuRetour: lieuRetour.trim() || null,
          dateDebutPrevue: startISO,
          dateFinPrevue: endISO,
          fraisSupplementaires: Number(fraisSupplementaires || '0'),
          remiseMontant: Number(remiseMontant || '0'),
          acomptePrevu: Number(acomptePrevu || '0'),
          cautionMontant: Number(cautionMontant),
          notes: notes.trim() || null,
          statutInitial,
        },
      });
      router.replace(`/locations/${rental.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message === RENTAL_CONFLICT_ERROR
          ? t('locations.form.errors.conflict')
          : t('locations.form.createError')
      );
    } finally {
      setSubmittingAs(null);
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
            items={(customersQuery.data ?? []).filter((c) => !c.archivedAt)}
            selectedItem={customer}
            getId={(c) => c.id}
            getLabel={(c) => c.nomComplet}
            getSubLabel={(c) => c.telephone ?? undefined}
            filterItems={searchCustomers}
            onSelect={(c) => {
              setCustomer(c);
              setDriver(null);
            }}
            error={showErrors && errors.customerId ? t(`locations.form.errors.${errors.customerId}`) : undefined}
          />

          {customer && (driversQuery.data ?? []).length > 0 ? (
            <PickerField
              label={t('locations.driver')}
              placeholder={t('locations.form.driverPlaceholder')}
              searchPlaceholder={t('locations.form.driverSearch')}
              items={driversQuery.data ?? []}
              selectedItem={driver}
              getId={(d) => d.id}
              getLabel={(d) => d.nomComplet}
              getSubLabel={(d) => d.telephone ?? undefined}
              filterItems={(items, query) =>
                items.filter((d) => d.nomComplet.toLowerCase().includes(query.toLowerCase()))
              }
              onSelect={setDriver}
            />
          ) : null}
          {customer ? (
            <ThemedText type="small" themeColor="textSecondary">
              {driver ? t('locations.driverIsOther') : t('locations.driverIsCustomer')}
            </ThemedText>
          ) : null}

          {vehicle ? (
            <View className="gap-1.5">
              <ThemedText type="small" themeColor="textSecondary">
                {t('locations.period')}
              </ThemedText>
              <DateRangeCalendar disabledDates={disabledDates} value={range} onChange={setRange} />
              <View className="flex-row gap-2">
                <TextField
                  label={t('locations.heureDepart')}
                  value={heureDepart}
                  onChangeText={setHeureDepart}
                  placeholder="09:00"
                  className="flex-1"
                />
                <TextField
                  label={t('locations.heureRetour')}
                  value={heureRetour}
                  onChangeText={setHeureRetour}
                  placeholder="18:00"
                  className="flex-1"
                />
              </View>
              {showErrors && errors.dates ? (
                <ThemedText type="small" style={{ color: '#dc2626' }}>
                  {t(`locations.form.errors.${errors.dates}`)}
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          <TextField label={t('locations.lieuDepart')} value={lieuDepart} onChangeText={setLieuDepart} placeholder={t('vehicle.fields.optionalPlaceholder')} />
          <TextField label={t('locations.lieuRetour')} value={lieuRetour} onChangeText={setLieuRetour} placeholder={t('vehicle.fields.optionalPlaceholder')} />

          {priceBreakdown ? (
            <View className="gap-1 rounded-2xl border border-[#e1e5f0] bg-white p-4">
              <View className="flex-row items-center justify-between">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('locations.priceBreakdown.duree', { count: priceBreakdown.dureeJours })}
                </ThemedText>
                <ThemedText type="small">{`${priceBreakdown.prixJourApplique.toLocaleString('fr-FR')} MAD/j`}</ThemedText>
              </View>
              <View className="flex-row items-center justify-between">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('locations.priceBreakdown.sousTotal')}
                </ThemedText>
                <ThemedText type="small">{`${priceBreakdown.sousTotal.toLocaleString('fr-FR')} MAD`}</ThemedText>
              </View>
              <View className="mt-1 flex-row items-center justify-between border-t border-[#e1e5f0] pt-2">
                <ThemedText type="smallBold">{t('locations.priceBreakdown.total')}</ThemedText>
                <ThemedText type="smallBold" themeColor="primary">{`${priceBreakdown.total.toLocaleString('fr-FR')} MAD`}</ThemedText>
              </View>
            </View>
          ) : null}

          <TextField
            label={t('locations.fraisSupplementaires')}
            value={fraisSupplementaires}
            onChangeText={setFraisSupplementaires}
            keyboardType="number-pad"
            error={showErrors && errors.fraisSupplementaires ? t(`locations.form.errors.${errors.fraisSupplementaires}`) : undefined}
          />
          <TextField
            label={t('locations.remiseMontant')}
            value={remiseMontant}
            onChangeText={setRemiseMontant}
            keyboardType="number-pad"
            error={showErrors && errors.remiseMontant ? t(`locations.form.errors.${errors.remiseMontant}`) : undefined}
          />
          <TextField
            label={t('locations.acomptePrevu')}
            value={acomptePrevu}
            onChangeText={setAcomptePrevu}
            keyboardType="number-pad"
            error={showErrors && errors.acomptePrevu ? t(`locations.form.errors.${errors.acomptePrevu}`) : undefined}
          />
          <TextField
            label={t('locations.cautionBlocked')}
            value={cautionMontant}
            onChangeText={setCautionMontant}
            keyboardType="number-pad"
            error={showErrors && errors.cautionMontant ? t(`locations.form.errors.${errors.cautionMontant}`) : undefined}
          />
          <TextField
            label={t('locations.notes')}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            className="min-h-20"
          />

          {submitError ? (
            <ThemedText type="small" style={{ color: '#dc2626' }}>
              {submitError}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={() => handleSubmit('en_attente_confirmation')}
            disabled={submittingAs !== null}
            className={`mt-2 flex-row items-center justify-center gap-2 rounded-2xl border border-[#1f5eff] px-4 py-4 ${
              submittingAs ? 'opacity-60' : ''
            }`}
          >
            {submittingAs === 'en_attente_confirmation' ? <ActivityIndicator color="#1f5eff" /> : null}
            <ThemedText type="smallBold" themeColor="primary">
              {t('locations.form.saveAsPending')}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => handleSubmit('confirmee')}
            disabled={submittingAs !== null}
            className={`flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
              submittingAs ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
            }`}
          >
            {submittingAs === 'confirmee' ? <ActivityIndicator color="#ffffff" /> : null}
            <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
              {t('locations.form.saveAsConfirmed')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
