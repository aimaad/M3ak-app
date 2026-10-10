import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { useCreateDriver, useDrivers, useRemoveDriver } from './hooks';
import { isDriverFormValid, toDriverInput, validateDriverForm, type DriverFormValues } from './driver-validation';

const EMPTY_VALUES: DriverFormValues = {
  nomComplet: '',
  cinOuPasseport: '',
  numeroPermis: '',
  telephone: '',
};

export function DriverList({
  agencyId,
  customerId,
  canRemove,
}: {
  agencyId: string;
  customerId: string;
  canRemove: boolean;
}) {
  const { t } = useLanguage();
  const driversQuery = useDrivers(customerId);
  const createDriver = useCreateDriver(customerId);
  const removeDriver = useRemoveDriver(customerId);

  const [showForm, setShowForm] = useState(false);
  const [values, setValues] = useState<DriverFormValues>(EMPTY_VALUES);
  const [touched, setTouched] = useState(false);

  const errors = validateDriverForm(values);

  function update<K extends keyof DriverFormValues>(key: K, value: DriverFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAdd() {
    setTouched(true);
    if (!isDriverFormValid(errors)) return;

    try {
      await createDriver.mutateAsync({ agencyId, input: toDriverInput(values) });
      setValues(EMPTY_VALUES);
      setTouched(false);
      setShowForm(false);
    } catch {
      Alert.alert(t('common.appName'), t('customer.driverAddError'));
    }
  }

  function handleRemove(driverId: string) {
    Alert.alert(t('customer.removeDriverConfirmTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('customer.removeDriver'),
        style: 'destructive',
        onPress: () => {
          removeDriver.mutate(driverId, {
            onError: () => Alert.alert(t('common.appName'), t('customer.driverRemoveError')),
          });
        },
      },
    ]);
  }

  return (
    <View className="gap-3">
      {driversQuery.isLoading ? (
        <ActivityIndicator color="#7C3AED" />
      ) : (driversQuery.data ?? []).length === 0 ? (
        <View className="h-16 items-center justify-center rounded-2xl border border-dashed border-[#EAE5F2] bg-white">
          <ThemedText type="small" themeColor="textSecondary">
            {t('customer.noDrivers')}
          </ThemedText>
        </View>
      ) : (
        (driversQuery.data ?? []).map((driver) => (
          <View
            key={driver.id}
            className="flex-row items-center justify-between rounded-2xl border border-[#EAE5F2] bg-white px-4 py-3"
          >
            <View>
              <ThemedText type="smallBold">{driver.nomComplet}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[driver.telephone, driver.numeroPermis].filter(Boolean).join(' · ') || '—'}
              </ThemedText>
            </View>
            {canRemove ? (
              <Pressable onPress={() => handleRemove(driver.id)} hitSlop={8}>
                <ThemedText type="small" style={{ color: '#DC2626' }}>
                  {t('customer.removeDriver')}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      {showForm ? (
        <View className="gap-2 rounded-2xl border border-[#EAE5F2] bg-white p-4">
          <TextField
            label={t('customer.fields.nomComplet')}
            value={values.nomComplet}
            onChangeText={(v) => update('nomComplet', v)}
            error={touched && errors.nomComplet ? t(`customer.form.errors.${errors.nomComplet}`) : undefined}
          />
          <TextField
            label={t('customer.fields.telephone')}
            value={values.telephone}
            onChangeText={(v) => update('telephone', v)}
            keyboardType="phone-pad"
          />
          <TextField
            label={t('customer.fields.cin')}
            value={values.cinOuPasseport}
            onChangeText={(v) => update('cinOuPasseport', v)}
          />
          <TextField
            label={t('customer.fields.permis')}
            value={values.numeroPermis}
            onChangeText={(v) => update('numeroPermis', v)}
          />
          <View className="flex-row gap-2">
            <Button label={t('common.cancel')} variant="secondary" size="sm" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
            <Button
              label={createDriver.isPending ? t('customer.form.saving') : t('customer.addDriver')}
              size="sm"
              onPress={handleAdd}
              disabled={createDriver.isPending}
              loading={createDriver.isPending}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowForm(true)}
          className="items-center rounded-2xl border border-[#EAE5F2] bg-white px-4 py-3"
        >
          <ThemedText type="small" themeColor="primary">
            {`+ ${t('customer.addDriver')}`}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}
