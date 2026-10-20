import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useContractForRental, useRecordDeparture } from '@/features/contracts/hooks';
import { ACCESSORY_KEYS, VEHICLE_CONDITIONS } from '@/features/contracts/types';
import type { AccessoryKey, VehicleCondition } from '@/features/contracts/types';
import { validateDepartContractForm } from '@/features/contracts/validation';
import { departureErrorKey } from '@/features/rentals/departure-check';
import { DepartureChecklist } from '@/features/rentals/departure-checklist';
import { useDepartureCheck, useRental } from '@/features/rentals/hooks';
import { validateOdometerForm } from '@/features/rentals/validation';
import { useMyAgency } from '@/features/agency/hooks';
import { useInspectionForRental } from '@/features/inspections/hooks';
import { useVehicle } from '@/features/vehicles/hooks';
import { clampPercentInput } from '@/lib/percent';
import { useLanguage } from '@/i18n/use-language';

export default function DepartScreen() {
  const { id, vehicleId } = useLocalSearchParams<{ id: string; vehicleId: string }>();
  const { t } = useLanguage();
  const { data: vehicle } = useVehicle(vehicleId);
  const { data: contract, isLoading: isLoadingContract } = useContractForRental(id);
  const recordDeparture = useRecordDeparture();
  const agencyQuery = useMyAgency();
  const { data: rental } = useRental(id);
  const departureCheck = useDepartureCheck(id);
  const { data: departInspection, isLoading: isLoadingInspection } = useInspectionForRental(id, 'depart');
  const departInspectionDone = departInspection?.statut === 'terminee' || departInspection?.statut === 'validee';
  // La politique de l'agence bloque le départ tant que la liste de contrôle n'est pas satisfaite (le serveur le refuse aussi).
  const departureBlocked = !!departureCheck.data && departureCheck.data.enforced && !departureCheck.data.ok;

  // Le contrat est fait avant le départ : il connaît déjà les relevés de l'inspection et l'état des lieux. On les reprend ;
  // l'employé peut tout corriger au moment de la remise des clés.
  const snapshot = (contract?.snapshotValues ?? {}) as Record<string, string | undefined>;
  const [kmInput, setKmInput] = useState<string | null>(null);
  const [carburantInput, setCarburantInput] = useState<string | null>(null);
  const [etatInput, setEtatInput] = useState<VehicleCondition | null>(null);
  const [accessoiresInput, setAccessoiresInput] = useState<AccessoryKey[] | null>(null);
  const [observationsInput, setObservationsInput] = useState<string | null>(null);
  const kilometrage = kmInput ?? snapshot.km_depart ?? (vehicle ? String(vehicle.kilometrage) : '');
  const carburant = carburantInput ?? (snapshot.carburant_depart ? snapshot.carburant_depart.replace(/[^\d]/g, '') : '100');
  const etatDepart = etatInput ?? contract?.etatDepart ?? null;
  const accessoires = accessoiresInput ?? contract?.accessoiresDepart ?? [];
  const observations = observationsInput ?? contract?.observationsDepart ?? '';
  const setKilometrage = setKmInput;
  const setCarburant = setCarburantInput;
  const setEtatDepart = setEtatInput;
  const setObservations = setObservationsInput;
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const odometerErrors = validateOdometerForm({ kilometrage, carburant }, vehicle?.kilometrage ?? 0);
  const contractErrors = validateDepartContractForm({ etatDepart, accessoiresDepart: accessoires, observationsDepart: observations });

  function toggleAccessoire(key: AccessoryKey) {
    setAccessoiresInput((prev) => {
      const current = prev ?? accessoires;
      return current.includes(key) ? current.filter((a) => a !== key) : [...current, key];
    });
  }

  async function handleSubmit() {
    setTouched(true);
    setError(null);
    if (
      Object.keys(odometerErrors).length > 0 ||
      Object.keys(contractErrors).length > 0 ||
      !id ||
      !vehicleId ||
      !contract ||
      !etatDepart
    ) {
      return;
    }

    try {
      await recordDeparture.mutateAsync({
        rentalId: id,
        contractId: contract.id,
        kmDepart: Number(kilometrage),
        carburantDepart: Number(carburant),
        input: { etatDepart, accessoiresDepart: accessoires, observationsDepart: observations.trim() || null },
      });
      router.back();
    } catch (err) {
      const message = (err as { message?: string } | null)?.message ?? '';
      setError(
        message.includes('departure_inspection_required')
          ? t('locations.departInspectionRequired.body')
          : message.includes('departure_requirements_not_met')
            ? t(departureErrorKey(err))
            : t('locations.depart.error')
      );
    }
  }

  if (isLoadingContract || isLoadingInspection) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('locations.depart.title')} showBack />
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#7C3AED" />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!contract || contract.statut !== 'signe') {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('locations.depart.title')} showBack />
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('contract.unavailableHint')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!departInspectionDone) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('locations.depart.title')} showBack />
          <View className="flex-1 items-center justify-center gap-4 px-8">
            <ThemedText type="smallBold" className="text-center">
              {t('locations.departInspectionRequired.title')}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('locations.departInspectionRequired.body')}
            </ThemedText>
            <Button
              label={t('locations.departInspectionRequired.action')}
              onPress={() => router.replace({ pathname: '/locations/[id]/inspection-depart', params: { id: id as string } })}
            />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('locations.depart.title')} showBack />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
          {rental && id ? (
            <DepartureChecklist rentalId={id} customerId={rental.customerId} role={agencyQuery.data?.role ?? null} />
          ) : null}

          <TextField
            label={t('locations.depart.kilometrage')}
            value={kilometrage}
            onChangeText={setKilometrage}
            keyboardType="number-pad"
            error={touched && odometerErrors.kilometrage ? t('locations.form.errors.invalid_number') : undefined}
          />
          <TextField
            label={t('locations.depart.carburant')}
            value={carburant}
            onChangeText={(v) => setCarburant(clampPercentInput(v))}
            keyboardType="number-pad"
            error={touched && odometerErrors.carburant ? t('locations.form.errors.invalid_number') : undefined}
          />

          <View className="gap-1.5">
            <ThemedText type="small" themeColor="textSecondary">
              {t('contract.fields.etatGeneral')}
            </ThemedText>
            <View className="flex-row flex-wrap gap-2">
              {VEHICLE_CONDITIONS.map((condition) => {
                const selected = etatDepart === condition;
                return (
                  <Pressable
                    key={condition}
                    onPress={() => setEtatDepart(condition)}
                    className={`rounded-full border px-4 py-2 ${selected ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'}`}
                  >
                    <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#211A2E' }}>
                      {t(`contract.condition.${condition}`)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {touched && contractErrors.etatDepart ? (
              <ThemedText type="small" style={{ color: '#DC2626' }}>
                {t('contract.form.errors.required')}
              </ThemedText>
            ) : null}
          </View>

          <View className="gap-1.5">
            <ThemedText type="small" themeColor="textSecondary">
              {t('contract.fields.accessoires')}
            </ThemedText>
            <View className="flex-row flex-wrap gap-2">
              {ACCESSORY_KEYS.map((key) => {
                const selected = accessoires.includes(key);
                return (
                  <Pressable
                    key={key}
                    onPress={() => toggleAccessoire(key)}
                    className={`rounded-full border px-4 py-2 ${selected ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'}`}
                  >
                    <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#211A2E' }}>
                      {t(`contract.accessory.${key}`)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <TextField
            label={t('contract.fields.observations')}
            value={observations}
            onChangeText={setObservations}
            multiline
            numberOfLines={3}
            className="min-h-20"
          />

          {error ? (
            <ThemedText type="small" style={{ color: '#DC2626' }}>
              {error}
            </ThemedText>
          ) : null}

          <Button
            label={recordDeparture.isPending ? t('locations.depart.saving') : t('locations.depart.save')}
            onPress={handleSubmit}
            disabled={recordDeparture.isPending || departureBlocked}
            loading={recordDeparture.isPending}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
