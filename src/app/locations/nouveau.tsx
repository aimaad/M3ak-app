import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PickerField } from '@/components/picker-field';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WizardProgress } from '@/components/wizard-progress';
import { useMyAgency } from '@/features/agency/hooks';
import { useCustomers } from '@/features/customers/hooks';
import { searchCustomers } from '@/features/customers/search';
import type { Customer } from '@/features/customers/types';
import { bookedDates, hasBookingConflict } from '@/features/rentals/availability';
import { DateRangeCalendar, type DateRangeValue } from '@/features/rentals/date-range-calendar';
import { useCreateRental, useDeparturePolicy, useSaveRentalDrivers, useVehicleRentals } from '@/features/rentals/hooks';
import { EMPTY_DRIVERS_SELECTION, rentalDriversErrorKey, type RentalDriversSelection } from '@/features/rentals/rental-drivers';
import { RentalDriversEditor } from '@/features/rentals/rental-drivers-editor';
import { computeRentalPrice } from '@/features/rentals/pricing';
import { RENTAL_CONFLICT_ERROR } from '@/features/rentals/api';
import { isRentalFormValid, validateRentalForm } from '@/features/rentals/validation';
import { firstInvalidStep, isStepValid, WIZARD_STEPS } from '@/features/rentals/wizard';
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
  const [driversSelection, setDriversSelection] = useState<RentalDriversSelection>(EMPTY_DRIVERS_SELECTION);
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
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittingAs, setSubmittingAs] = useState<'en_attente_confirmation' | 'confirmee' | null>(null);

  const policyQuery = useDeparturePolicy(agencyQuery.data?.agencyId);
  const saveRentalDriversMutation = useSaveRentalDrivers();

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
      driverId: null,
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
          driverId: null,
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
      // Les conducteurs sont enregistrés juste après la réservation, d'un seul bloc (atomique) : les
      // fiches existantes sont réutilisées, un nouveau conducteur est créé sous le client.
      if (driversSelection.principal || driversSelection.additional.length > 0) {
        try {
          await saveRentalDriversMutation.mutateAsync({
            agencyId: agencyQuery.data.agencyId,
            customerId: customer.id,
            rentalId: rental.id,
            selection: driversSelection,
          });
        } catch (driversError) {
          Alert.alert(t('common.appName'), t(rentalDriversErrorKey(driversError)));
        }
      }
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

  const stepKey = WIZARD_STEPS[step];
  const isLast = step === WIZARD_STEPS.length - 1;
  const busy = submittingAs !== null;

  function goTo(index: number) {
    setStep(index);
    setTouched(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function handleNext() {
    if (!isStepValid(stepKey, errors)) {
      setTouched(true);
      return;
    }
    goTo(step + 1);
  }

  /** Au récapitulatif, une erreur renvoie vers l'étape à corriger. */
  function submitFromRecap(statutInitial: 'en_attente_confirmation' | 'confirmee') {
    const invalid = firstInvalidStep(errors);
    if (invalid) {
      goTo(WIZARD_STEPS.indexOf(invalid));
      setTouched(true);
      return;
    }
    handleSubmit(statutInitial);
  }

  const money = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} MAD`;
  const driversCount = (driversSelection.principal ? 1 : 0) + driversSelection.additional.length;
  const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

  const fieldError = (key: keyof typeof errors) => (showErrors && errors[key] ? t(`locations.form.errors.${errors[key]}`) : undefined);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('locations.form.newTitle')} showBack />
        <WizardProgress
          current={step}
          total={WIZARD_STEPS.length}
          title={t(`locations.wizard.steps.${stepKey}.title`)}
          stepLabel={t('locations.wizard.stepOf', { current: step + 1, total: WIZARD_STEPS.length })}
        />
        <ScrollView ref={scrollRef} contentContainerClassName="gap-4 px-6 pb-6" keyboardShouldPersistTaps="handled">
          <ThemedText type="small" themeColor="textSecondary">
            {t(`locations.wizard.steps.${stepKey}.help`)}
          </ThemedText>

          {stepKey === 'client' ? (
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
                setDriversSelection(EMPTY_DRIVERS_SELECTION);
              }}
              error={fieldError('customerId')}
            />
          ) : null}

          {stepKey === 'vehicule' ? (
            <PickerField
              label={t('locations.vehicle')}
              placeholder={t('locations.form.vehiclePlaceholder')}
              searchPlaceholder={t('locations.form.vehicleSearch')}
              items={vehiclesQuery.data ?? []}
              selectedItem={vehicle}
              getId={(v) => v.id}
              getLabel={(v) => `${v.marque} ${v.modele}`}
              getSubLabel={(v) => v.immatriculation}
              filterItems={(items, query) => filterVehicles(items, { ...DEFAULT_VEHICLE_FILTERS, query })}
              onSelect={(v) => {
                setVehicle(v);
                setRange({ start: null, end: null });
              }}
              error={fieldError('vehicleId')}
            />
          ) : null}

          {stepKey === 'dates' ? (
            <>
              <View className="gap-1.5">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('locations.period')}
                </ThemedText>
                <DateRangeCalendar disabledDates={disabledDates} value={range} onChange={setRange} />
                <View className="flex-row gap-2">
                  <TextField label={t('locations.heureDepart')} value={heureDepart} onChangeText={setHeureDepart} placeholder="09:00" className="flex-1" />
                  <TextField label={t('locations.heureRetour')} value={heureRetour} onChangeText={setHeureRetour} placeholder="18:00" className="flex-1" />
                </View>
                {showErrors && errors.dates ? (
                  <ThemedText type="small" style={{ color: '#DC2626' }}>
                    {t(`locations.form.errors.${errors.dates}`)}
                  </ThemedText>
                ) : null}
              </View>
              <TextField label={t('locations.lieuDepart')} value={lieuDepart} onChangeText={setLieuDepart} placeholder={t('vehicle.fields.optionalPlaceholder')} />
              <TextField label={t('locations.lieuRetour')} value={lieuRetour} onChangeText={setLieuRetour} placeholder={t('vehicle.fields.optionalPlaceholder')} />
            </>
          ) : null}

          {stepKey === 'conducteurs' && customer ? (
            <RentalDriversEditor
              customer={customer}
              value={driversSelection}
              onChange={setDriversSelection}
              maxAdditional={policyQuery.data?.maxAdditionalDrivers}
              disabled={busy}
            />
          ) : null}

          {stepKey === 'prix' ? (
            <>
              {priceBreakdown ? (
                <View className="gap-1 rounded-2xl border border-[#EAE5F2] bg-white p-4">
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
                  <View className="mt-1 flex-row items-center justify-between border-t border-[#EAE5F2] pt-2">
                    <ThemedText type="smallBold">{t('locations.priceBreakdown.total')}</ThemedText>
                    <ThemedText type="smallBold" themeColor="primary">{`${priceBreakdown.total.toLocaleString('fr-FR')} MAD`}</ThemedText>
                  </View>
                </View>
              ) : null}
              <TextField label={t('locations.fraisSupplementaires')} value={fraisSupplementaires} onChangeText={setFraisSupplementaires} keyboardType="number-pad" error={fieldError('fraisSupplementaires')} />
              <TextField label={t('locations.remiseMontant')} value={remiseMontant} onChangeText={setRemiseMontant} keyboardType="number-pad" error={fieldError('remiseMontant')} />
              <TextField label={t('locations.acomptePrevu')} value={acomptePrevu} onChangeText={setAcomptePrevu} keyboardType="number-pad" error={fieldError('acomptePrevu')} />
              <TextField label={t('locations.cautionBlocked')} value={cautionMontant} onChangeText={setCautionMontant} keyboardType="number-pad" error={fieldError('cautionMontant')} />
              <TextField label={t('locations.notes')} value={notes} onChangeText={setNotes} multiline numberOfLines={3} className="min-h-20" />
            </>
          ) : null}

          {stepKey === 'recap' ? (
            <>
              <View className="rounded-2xl border border-[#EAE5F2] bg-white px-4">
                {(
                  [
                    [t('locations.customer'), customer?.nomComplet ?? '—'],
                    [t('locations.drivers.sectionTitle'), driversCount > 0 ? t('locations.wizard.driversCount', { count: driversCount }) : t('locations.wizard.driversNone')],
                    [t('locations.vehicle'), vehicle ? `${vehicle.marque} ${vehicle.modele} · ${vehicle.immatriculation}` : '—'],
                    [t('locations.period'), `${formatDate(startISO)} → ${formatDate(endISO)}`],
                    ...(lieuDepart.trim() ? [[t('locations.lieuDepart'), lieuDepart.trim()]] : []),
                    ...(lieuRetour.trim() ? [[t('locations.lieuRetour'), lieuRetour.trim()]] : []),
                    [t('locations.acomptePrevu'), money(Number(acomptePrevu || '0'))],
                    [t('locations.cautionBlocked'), money(Number(cautionMontant || '0'))],
                    ...(notes.trim() ? [[t('locations.notes'), notes.trim()]] : []),
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <View key={label} className="border-b border-[#EAE5F2] py-3 last:border-b-0">
                    <ThemedText type="small" themeColor="textSecondary">
                      {label}
                    </ThemedText>
                    <ThemedText type="smallBold">{value}</ThemedText>
                  </View>
                ))}
                <View className="flex-row items-center justify-between py-3">
                  <ThemedText type="smallBold">{t('locations.priceBreakdown.total')}</ThemedText>
                  <ThemedText type="subtitle" themeColor="primary">
                    {priceBreakdown ? money(priceBreakdown.total) : '—'}
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {t('locations.wizard.afterCreate')}
              </ThemedText>
              {submitError ? (
                <ThemedText type="small" style={{ color: '#DC2626' }}>
                  {submitError}
                </ThemedText>
              ) : null}
            </>
          ) : null}
        </ScrollView>

        <View className="gap-2 border-t border-[#EAE5F2] bg-white px-6 py-3">
          {isLast ? (
            <>
              <Button label={t('locations.form.saveAsConfirmed')} onPress={() => submitFromRecap('confirmee')} disabled={busy} loading={submittingAs === 'confirmee'} />
              <Button label={t('locations.form.saveAsPending')} variant="secondary" onPress={() => submitFromRecap('en_attente_confirmation')} disabled={busy} loading={submittingAs === 'en_attente_confirmation'} />
            </>
          ) : (
            <Button label={t('locations.wizard.next')} onPress={handleNext} />
          )}
          {step > 0 ? <Button label={t('locations.wizard.previous')} variant="ghost" size="sm" onPress={() => goTo(step - 1)} disabled={busy} /> : null}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
