import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PickerField } from '@/components/picker-field';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { useCreateMaintenanceItem } from '@/features/maintenance/hooks';
import { MAINTENANCE_TYPES, type MaintenanceType } from '@/features/maintenance/types';
import {
  isMaintenanceFormValid,
  validateMaintenanceForm,
  type MaintenanceFormValues,
} from '@/features/maintenance/validation';
import { filterVehicles } from '@/features/vehicles/filters';
import { useVehicles } from '@/features/vehicles/hooks';
import type { Vehicle } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

const EMPTY_VALUES: MaintenanceFormValues = {
  vehicleId: '',
  type: 'vidange',
  echeanceDate: '',
  echeanceKm: '',
  notes: '',
};

export default function NouvelleMaintenanceScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const vehiclesQuery = useVehicles();
  const createItem = useCreateMaintenanceItem();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [values, setValues] = useState<MaintenanceFormValues>(EMPTY_VALUES);
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = validateMaintenanceForm(values);

  function update<K extends keyof MaintenanceFormValues>(key: K, value: MaintenanceFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setTouched(true);
    setSubmitError(null);
    if (!isMaintenanceFormValid(errors) || !agencyQuery.data) return;

    try {
      await createItem.mutateAsync({
        agencyId: agencyQuery.data.agencyId,
        input: {
          vehicleId: values.vehicleId,
          type: values.type,
          echeanceDate: values.echeanceDate.trim() || null,
          echeanceKm: values.echeanceKm.trim() ? Number(values.echeanceKm) : null,
          notes: values.notes.trim() || null,
        },
      });
      router.back();
    } catch {
      setSubmitError(t('maintenance.form.createError'));
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('maintenance.form.newTitle')} showBack />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
          <PickerField
            label={t('locations.vehicle')}
            placeholder={t('maintenance.form.vehiclePlaceholder')}
            searchPlaceholder={t('maintenance.form.vehicleSearch')}
            items={vehiclesQuery.data ?? []}
            selectedItem={vehicle}
            getId={(v) => v.id}
            getLabel={(v) => `${v.marque} ${v.modele}`}
            getSubLabel={(v) => v.immatriculation}
            filterItems={(items, query) => filterVehicles(items, 'tous', query)}
            onSelect={(v) => {
              setVehicle(v);
              update('vehicleId', v.id);
            }}
            error={touched && errors.vehicleId ? t(`maintenance.form.errors.${errors.vehicleId}`) : undefined}
          />

          <View className="gap-1.5">
            <ThemedText type="small" themeColor="textSecondary">
              {t('maintenance.form.type')}
            </ThemedText>
            <View className="flex-row flex-wrap gap-2">
              {MAINTENANCE_TYPES.map((type: MaintenanceType) => {
                const selected = values.type === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => update('type', type)}
                    className={`rounded-full border px-4 py-2 ${
                      selected ? 'border-[#1f5eff] bg-[#1f5eff]' : 'border-[#e1e5f0] bg-white'
                    }`}
                  >
                    <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#101423' }}>
                      {t(`maintenance.types.${type}`)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <TextField
            label={t('maintenance.form.echeanceDate')}
            value={values.echeanceDate}
            onChangeText={(v) => update('echeanceDate', v)}
            placeholder="2026-04-01"
            error={
              touched && errors.echeanceDate ? t(`maintenance.form.errors.${errors.echeanceDate}`) : undefined
            }
          />
          <TextField
            label={t('maintenance.form.echeanceKm')}
            value={values.echeanceKm}
            onChangeText={(v) => update('echeanceKm', v)}
            keyboardType="number-pad"
            error={
              touched && errors.echeanceKm ? t(`maintenance.form.errors.${errors.echeanceKm}`) : undefined
            }
          />
          <TextField
            label={t('maintenance.form.notes')}
            value={values.notes}
            onChangeText={(v) => update('notes', v)}
          />

          {submitError ? (
            <ThemedText type="small" style={{ color: '#dc2626' }}>
              {submitError}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={createItem.isPending}
            className={`mt-2 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
              createItem.isPending ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
            }`}
          >
            {createItem.isPending ? <ActivityIndicator color="#ffffff" /> : null}
            <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
              {createItem.isPending ? t('maintenance.form.saving') : t('maintenance.form.save')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
