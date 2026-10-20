import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useContractForRental, useRecordReturn } from '@/features/contracts/hooks';
import { ACCESSORY_KEYS, VEHICLE_CONDITIONS } from '@/features/contracts/types';
import type { AccessoryKey, VehicleCondition } from '@/features/contracts/types';
import { validateRetourContractForm } from '@/features/contracts/validation';
import { computeFraisCarburant, computeFraisRetard, computeRetardMinutes } from '@/features/contracts/fees';
import { useRental } from '@/features/rentals/hooks';
import { validateOdometerForm } from '@/features/rentals/validation';
import { useVehicle } from '@/features/vehicles/hooks';
import { clampPercentInput } from '@/lib/percent';
import { useLanguage } from '@/i18n/use-language';

export default function RetourScreen() {
  const { id, vehicleId } = useLocalSearchParams<{ id: string; vehicleId: string }>();
  const { t } = useLanguage();
  const { data: vehicle } = useVehicle(vehicleId);
  const { data: rental } = useRental(id);
  const { data: contract, isLoading: isLoadingContract } = useContractForRental(id);
  const recordReturn = useRecordReturn();

  const [kilometrage, setKilometrage] = useState(vehicle ? String(vehicle.kilometrage) : '');
  const [carburant, setCarburant] = useState('100');
  const [etatRetour, setEtatRetour] = useState<VehicleCondition | null>(null);
  const [accessoires, setAccessoires] = useState<AccessoryKey[]>([]);
  const [observations, setObservations] = useState('');
  const [justification, setJustification] = useState('');
  const [appliquerFrais, setAppliquerFrais] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const odometerErrors = validateOdometerForm({ kilometrage, carburant }, vehicle?.kilometrage ?? 0);
  const contractErrors = validateRetourContractForm({ etatRetour, accessoiresRetour: accessoires, observationsRetour: observations, fraisJustification: justification });

  const fees = useMemo(() => {
    if (!rental) return null;
    const retardMinutes = computeRetardMinutes(rental.dateFinPrevue, new Date().toISOString());
    const fraisRetard = computeFraisRetard(retardMinutes);
    const fraisCarburant = rental.carburantDepart != null ? computeFraisCarburant(rental.carburantDepart, Number(carburant || '0')) : 0;
    return { retardMinutes, fraisRetard, fraisCarburant };
  }, [rental, carburant]);

  function toggleAccessoire(key: AccessoryKey) {
    setAccessoires((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));
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
      !etatRetour ||
      !fees
    ) {
      return;
    }

    try {
      await recordReturn.mutateAsync({
        rentalId: id,
        contractId: contract.id,
        kmRetour: Number(kilometrage),
        carburantRetour: Number(carburant),
        input: {
          etatRetour,
          accessoiresRetour: accessoires,
          observationsRetour: observations.trim() || null,
          retardMinutes: fees.retardMinutes,
          fraisRetardPropose: fees.fraisRetard,
          fraisCarburantPropose: fees.fraisCarburant,
          fraisJustification: justification.trim() || null,
          appliquerFrais,
        },
      });
      router.back();
    } catch {
      setError(t('locations.retour.error'));
    }
  }

  if (isLoadingContract) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('locations.retour.title')} showBack />
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#7C3AED" />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!contract || contract.statut !== 'en_cours') {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('locations.retour.title')} showBack />
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('contract.unavailableHint')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const totalFrais = (fees?.fraisRetard ?? 0) + (fees?.fraisCarburant ?? 0);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('locations.retour.title')} showBack />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
          <TextField
            label={t('locations.retour.kilometrage')}
            value={kilometrage}
            onChangeText={setKilometrage}
            keyboardType="number-pad"
            error={touched && odometerErrors.kilometrage ? t('locations.form.errors.invalid_number') : undefined}
          />
          <TextField
            label={t('locations.retour.carburant')}
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
                const selected = etatRetour === condition;
                return (
                  <Pressable
                    key={condition}
                    onPress={() => setEtatRetour(condition)}
                    className={`rounded-full border px-4 py-2 ${selected ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'}`}
                  >
                    <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#211A2E' }}>
                      {t(`contract.condition.${condition}`)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {touched && contractErrors.etatRetour ? (
              <ThemedText type="small" style={{ color: '#DC2626' }}>
                {t('contract.form.errors.required')}
              </ThemedText>
            ) : null}
          </View>

          <View className="gap-1.5">
            <ThemedText type="small" themeColor="textSecondary">
              {t('contract.fields.accessoiresManquants')}
            </ThemedText>
            <View className="flex-row flex-wrap gap-2">
              {ACCESSORY_KEYS.map((key) => {
                const selected = accessoires.includes(key);
                return (
                  <Pressable
                    key={key}
                    onPress={() => toggleAccessoire(key)}
                    className={`rounded-full border px-4 py-2 ${selected ? 'border-[#DC2626] bg-[#FEE2E2]' : 'border-[#EAE5F2] bg-white'}`}
                  >
                    <ThemedText type="small" style={{ color: selected ? '#DC2626' : '#211A2E' }}>
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

          {fees && totalFrais > 0 ? (
            <View className="gap-2 rounded-2xl bg-[#FEF3C7] p-4">
              <ThemedText type="smallBold" style={{ color: '#B45309' }}>
                {t('contract.fields.fraisProposes')}
              </ThemedText>
              {fees.retardMinutes > 0 ? (
                <ThemedText type="small" style={{ color: '#B45309' }}>
                  {t('contract.feeRetard', { minutes: fees.retardMinutes, amount: fees.fraisRetard })}
                </ThemedText>
              ) : null}
              {fees.fraisCarburant > 0 ? (
                <ThemedText type="small" style={{ color: '#B45309' }}>
                  {t('contract.feeCarburant', { amount: fees.fraisCarburant })}
                </ThemedText>
              ) : null}
              <TextField
                placeholder={t('contract.fraisJustificationPlaceholder')}
                value={justification}
                onChangeText={setJustification}
              />
              <Pressable onPress={() => setAppliquerFrais((prev) => !prev)} className="flex-row items-center gap-2">
                <View className={`h-5 w-5 items-center justify-center rounded border ${appliquerFrais ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#B3A6C2] bg-white'}`}>
                  {appliquerFrais ? <ThemedText type="small" style={{ color: '#ffffff' }}>✓</ThemedText> : null}
                </View>
                <ThemedText type="small">{t('contract.applyFeesLabel', { amount: totalFrais })}</ThemedText>
              </Pressable>
            </View>
          ) : null}

          {error ? (
            <ThemedText type="small" style={{ color: '#DC2626' }}>
              {error}
            </ThemedText>
          ) : null}

          <Button
            label={recordReturn.isPending ? t('locations.retour.saving') : t('locations.retour.save')}
            onPress={handleSubmit}
            disabled={recordReturn.isPending}
            loading={recordReturn.isPending}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
