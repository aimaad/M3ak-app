import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useContractForRental, useRecordDeparture } from '@/features/contracts/hooks';
import { ACCESSORY_KEYS, VEHICLE_CONDITIONS } from '@/features/contracts/types';
import type { AccessoryKey, VehicleCondition } from '@/features/contracts/types';
import { validateDepartContractForm } from '@/features/contracts/validation';
import { validateOdometerForm } from '@/features/rentals/validation';
import { useVehicle } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

export default function DepartScreen() {
  const { id, vehicleId } = useLocalSearchParams<{ id: string; vehicleId: string }>();
  const { t } = useLanguage();
  const { data: vehicle } = useVehicle(vehicleId);
  const { data: contract, isLoading: isLoadingContract } = useContractForRental(id);
  const recordDeparture = useRecordDeparture();

  const [kilometrage, setKilometrage] = useState(vehicle ? String(vehicle.kilometrage) : '');
  const [carburant, setCarburant] = useState('100');
  const [etatDepart, setEtatDepart] = useState<VehicleCondition | null>(null);
  const [accessoires, setAccessoires] = useState<AccessoryKey[]>([]);
  const [observations, setObservations] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const odometerErrors = validateOdometerForm({ kilometrage, carburant }, vehicle?.kilometrage ?? 0);
  const contractErrors = validateDepartContractForm({ etatDepart, accessoiresDepart: accessoires, observationsDepart: observations });

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
    } catch {
      setError(t('locations.depart.error'));
    }
  }

  if (isLoadingContract) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('locations.depart.title')} showBack />
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1f5eff" />
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

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('locations.depart.title')} showBack />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
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
            onChangeText={setCarburant}
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
                    className={`rounded-full border px-4 py-2 ${selected ? 'border-[#1f5eff] bg-[#1f5eff]' : 'border-[#e1e5f0] bg-white'}`}
                  >
                    <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#101423' }}>
                      {t(`contract.condition.${condition}`)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {touched && contractErrors.etatDepart ? (
              <ThemedText type="small" style={{ color: '#dc2626' }}>
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
                    className={`rounded-full border px-4 py-2 ${selected ? 'border-[#1f5eff] bg-[#1f5eff]' : 'border-[#e1e5f0] bg-white'}`}
                  >
                    <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#101423' }}>
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
            <ThemedText type="small" style={{ color: '#dc2626' }}>
              {error}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={recordDeparture.isPending}
            className={`mt-2 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
              recordDeparture.isPending ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
            }`}
          >
            {recordDeparture.isPending ? <ActivityIndicator color="#ffffff" /> : null}
            <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
              {recordDeparture.isPending ? t('locations.depart.saving') : t('locations.depart.save')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
