import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/text-field';
import { useLanguage } from '@/i18n/use-language';

import { FUEL_TYPES, VEHICLE_STATUSES } from './types';
import { isFormValid, toVehicleInput, validateVehicleForm, type VehicleFormValues } from './validation';
import type { VehicleInput } from './types';

type VehicleFormProps = {
  initialValues?: VehicleFormValues;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  submitError?: string | null;
  onSubmit: (input: VehicleInput) => void;
};

const EMPTY_VALUES: VehicleFormValues = {
  marque: '',
  modele: '',
  immatriculation: '',
  annee: '',
  carburant: 'essence',
  kilometrage: '',
  prixJour: '',
  statut: 'disponible',
};

export function VehicleForm({
  initialValues,
  submitLabel,
  submittingLabel,
  isSubmitting,
  submitError,
  onSubmit,
}: VehicleFormProps) {
  const { t } = useLanguage();
  const [values, setValues] = useState<VehicleFormValues>(initialValues ?? EMPTY_VALUES);
  const [touched, setTouched] = useState(false);

  const errors = validateVehicleForm(values);
  const showErrors = touched;

  function update<K extends keyof VehicleFormValues>(key: K, value: VehicleFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    setTouched(true);
    if (!isFormValid(errors)) return;
    onSubmit(toVehicleInput(values));
  }

  return (
    <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
      <TextField
        label={t('vehicle.fields.marque')}
        value={values.marque}
        onChangeText={(v) => update('marque', v)}
        error={showErrors && errors.marque ? t(`vehicle.form.errors.${errors.marque}`) : undefined}
      />
      <TextField
        label={t('vehicle.fields.modele')}
        value={values.modele}
        onChangeText={(v) => update('modele', v)}
        error={showErrors && errors.modele ? t(`vehicle.form.errors.${errors.modele}`) : undefined}
      />
      <TextField
        label={t('vehicle.fields.immatriculation')}
        value={values.immatriculation}
        onChangeText={(v) => update('immatriculation', v)}
        error={
          showErrors && errors.immatriculation
            ? t(`vehicle.form.errors.${errors.immatriculation}`)
            : undefined
        }
      />
      <TextField
        label={t('vehicle.fields.annee')}
        value={values.annee}
        onChangeText={(v) => update('annee', v)}
        keyboardType="number-pad"
        error={showErrors && errors.annee ? t(`vehicle.form.errors.${errors.annee}`) : undefined}
      />

      <View className="gap-1.5">
        <ThemedText type="small" themeColor="textSecondary">
          {t('vehicle.fields.carburant')}
        </ThemedText>
        <View className="flex-row flex-wrap gap-2">
          {FUEL_TYPES.map((fuel) => {
            const selected = values.carburant === fuel;
            return (
              <Pressable
                key={fuel}
                onPress={() => update('carburant', fuel)}
                className={`rounded-full border px-4 py-2 ${
                  selected ? 'border-[#1f5eff] bg-[#1f5eff]' : 'border-[#e1e5f0] bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#101423' }}>
                  {t(`vehicle.fuel.${fuel}`)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextField
        label={t('vehicle.fields.kilometrage')}
        value={values.kilometrage}
        onChangeText={(v) => update('kilometrage', v)}
        keyboardType="number-pad"
        error={
          showErrors && errors.kilometrage ? t(`vehicle.form.errors.${errors.kilometrage}`) : undefined
        }
      />
      <TextField
        label={t('vehicle.fields.prixJour')}
        value={values.prixJour}
        onChangeText={(v) => update('prixJour', v)}
        keyboardType="number-pad"
        error={showErrors && errors.prixJour ? t(`vehicle.form.errors.${errors.prixJour}`) : undefined}
      />

      <View className="gap-1.5">
        <ThemedText type="small" themeColor="textSecondary">
          {t('vehicle.fields.statut')}
        </ThemedText>
        <View className="flex-row flex-wrap gap-2">
          {VEHICLE_STATUSES.map((status) => {
            const selected = values.statut === status;
            return (
              <Pressable
                key={status}
                onPress={() => update('statut', status)}
                className={`rounded-full border px-4 py-2 ${
                  selected ? 'border-[#101423] bg-[#101423]' : 'border-[#e1e5f0] bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#101423' }}>
                  {t(`flotte.status.${status}`)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {submitError ? (
        <View className="rounded-2xl bg-[#fee2e2] px-4 py-3">
          <ThemedText type="small" style={{ color: '#dc2626' }}>
            {submitError}
          </ThemedText>
        </View>
      ) : null}

      <Pressable
        onPress={handleSubmit}
        disabled={isSubmitting}
        className={`mt-2 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
          isSubmitting ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
        }`}
      >
        {isSubmitting ? <ActivityIndicator color="#ffffff" /> : null}
        <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
          {isSubmitting ? submittingLabel : submitLabel}
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}
