import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChipGroup } from '@/components/chip-group';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import {
  buildDriverCandidates,
  newDriverCandidate,
  searchDriverCandidates,
  type DriverCandidate,
} from '@/features/customers/driver-candidates';
import { isDriverFormValid, toDriverInput, validateDriverForm, type DriverFormValues } from '@/features/customers/driver-validation';
import { useAllDrivers, useCustomers } from '@/features/customers/hooks';
import type { Customer } from '@/features/customers/types';
import { useLanguage } from '@/i18n/use-language';

import {
  addAdditionalDriver,
  DEFAULT_MAX_ADDITIONAL_DRIVERS,
  EMPTY_DRIVERS_SELECTION,
  hasOtherDrivers,
  removeAdditionalDriver,
  setPrincipalDriver,
  type AddDriverError,
  type RentalDriversSelection,
} from './rental-drivers';

type Props = {
  /** Client qui réserve (contractuel) : il reste distinct des conducteurs autorisés. */
  customer: Customer | null;
  value: RentalDriversSelection;
  onChange: (value: RentalDriversSelection) => void;
  maxAdditional?: number;
  disabled?: boolean;
};

const EMPTY_NEW_DRIVER: DriverFormValues = { prenom: '', nom: '', cinOuPasseport: '', numeroPermis: '', telephone: '' };
const MAX_RESULTS = 6;

type Answer = 'no' | 'yes';

function subLabel(candidate: DriverCandidate, t: (key: string, params?: Record<string, unknown>) => string): string {
  const parts: string[] = [];
  if (candidate.kind === 'customer') parts.push(t('locations.drivers.kindCustomer'));
  if (candidate.kind === 'driver' && candidate.ownerCustomerName) {
    parts.push(t('locations.drivers.driverOf', { name: candidate.ownerCustomerName }));
  }
  if (candidate.kind === 'new') parts.push(t('locations.drivers.kindNew'));
  if (candidate.telephone) parts.push(candidate.telephone);
  if (candidate.numeroPermis) parts.push(t('locations.drivers.licenceShort', { number: candidate.numeroPermis }));
  return parts.join(' · ');
}

/**
 * « Y a-t-il d'autres conducteurs pour cette location ? » : recherche d'un conducteur ou client existant
 * (nom ou téléphone), ajout d'un nouveau conducteur sans quitter la réservation, conducteur principal
 * distinct du client, retrait avant confirmation, doublons refusés.
 */
export function RentalDriversEditor({ customer, value, onChange, maxAdditional, disabled }: Props) {
  const { t } = useLanguage();
  const customersQuery = useCustomers();
  const driversQuery = useAllDrivers();
  const max = maxAdditional ?? DEFAULT_MAX_ADDITIONAL_DRIVERS;
  const ctx = { customerId: customer?.id ?? null, maxAdditional: max };

  const [answer, setAnswer] = useState<Answer>(hasOtherDrivers(value) ? 'yes' : 'no');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newDriver, setNewDriver] = useState<DriverFormValues>(EMPTY_NEW_DRIVER);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<AddDriverError | null>(null);

  const candidates = useMemo(
    () => buildDriverCandidates(customersQuery.data ?? [], driversQuery.data ?? []),
    [customersQuery.data, driversQuery.data]
  );

  const selectedKeys = new Set([value.principal?.key, ...value.additional.map((c) => c.key)].filter(Boolean) as string[]);
  const results = useMemo(
    () =>
      query.trim()
        ? searchDriverCandidates(candidates, query)
            .filter((candidate) => !selectedKeys.has(candidate.key))
            .slice(0, MAX_RESULTS)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidates, query, value]
  );

  const errors = validateDriverForm(newDriver);

  function chooseAnswer(next: Answer) {
    if (next === answer) return;
    if (next === 'no' && hasOtherDrivers(value)) {
      Alert.alert(t('locations.drivers.clearTitle'), t('locations.drivers.clearBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('locations.drivers.clearConfirm'),
          style: 'destructive',
          onPress: () => {
            onChange(EMPTY_DRIVERS_SELECTION);
            setAnswer('no');
          },
        },
      ]);
      return;
    }
    setAnswer(next);
  }

  function addCandidate(candidate: DriverCandidate) {
    const result = addAdditionalDriver(value, candidate, ctx);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    onChange(result.selection);
    return true;
  }

  function handleAddNew() {
    setTouched(true);
    if (!isDriverFormValid(errors)) return;
    if (addCandidate(newDriverCandidate(toDriverInput(newDriver)))) {
      setNewDriver(EMPTY_NEW_DRIVER);
      setTouched(false);
      setAdding(false);
    }
  }

  const principalLabel = value.principal ? value.principal.nomComplet : customer?.nomComplet ?? t('locations.drivers.theCustomer');

  return (
    <Card className="gap-3">
      <ThemedText type="smallBold">{t('locations.drivers.question')}</ThemedText>
      <ChipGroup<Answer>
        options={['no', 'yes']}
        selected={answer}
        disabled={disabled}
        getLabel={(option) => t(`locations.drivers.answer.${option}`)}
        onSelect={chooseAnswer}
      />

      {answer === 'yes' ? (
        <View className="gap-3">
          <ThemedText type="small" themeColor="textSecondary">
            {t('locations.drivers.separationHint')}
          </ThemedText>

          <View className="gap-1 rounded-2xl bg-[#EDE9FE] px-4 py-3">
            <ThemedText type="small" style={{ color: M3akPalette.mauveDeep }}>
              {t('locations.drivers.principal')}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: M3akPalette.mauveDeep }}>
              {principalLabel}
              {value.principal ? '' : ` (${t('locations.drivers.theClient')})`}
            </ThemedText>
            {value.principal && !disabled ? (
              <Pressable onPress={() => onChange(setPrincipalDriver(value, null, ctx))} hitSlop={6}>
                <ThemedText type="small" themeColor="primary">
                  {t('locations.drivers.customerDrives')}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {value.additional.length > 0 ? (
            <View className="gap-2">
              <ThemedText type="small" themeColor="textSecondary">
                {t('locations.drivers.additional', { count: value.additional.length, max })}
              </ThemedText>
              {value.additional.map((candidate) => (
                <View key={candidate.key} className="gap-1 rounded-2xl border border-[#E4DCF5] bg-white px-4 py-3">
                  <ThemedText type="smallBold">{candidate.nomComplet}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {subLabel(candidate, t) || '—'}
                  </ThemedText>
                  {!disabled ? (
                    <View className="flex-row gap-4 pt-1">
                      <Pressable onPress={() => onChange(setPrincipalDriver(value, candidate, ctx))} hitSlop={6}>
                        <ThemedText type="small" themeColor="primary">
                          {t('locations.drivers.makePrincipal')}
                        </ThemedText>
                      </Pressable>
                      <Pressable onPress={() => onChange(removeAdditionalDriver(value, candidate.key))} hitSlop={6}>
                        <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                          {t('locations.drivers.remove')}
                        </ThemedText>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {!disabled ? (
            <View className="gap-2">
              <TextField
                label={t('locations.drivers.searchLabel')}
                placeholder={t('locations.drivers.searchPlaceholder')}
                value={query}
                onChangeText={(v) => {
                  setQuery(v);
                  setError(null);
                }}
                autoCapitalize="none"
              />
              {query.trim() && results.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('locations.drivers.noResult')}
                </ThemedText>
              ) : null}
              {results.map((candidate) => (
                <Pressable
                  key={candidate.key}
                  onPress={() => {
                    if (addCandidate(candidate)) setQuery('');
                  }}
                  className="rounded-2xl border border-[#E4DCF5] bg-white px-4 py-3 active:bg-[#FAF9FF]"
                >
                  <ThemedText type="smallBold">{candidate.nomComplet}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {subLabel(candidate, t) || '—'}
                  </ThemedText>
                </Pressable>
              ))}
              {error ? (
                <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                  {t(`locations.drivers.addErrors.${error}`, { max })}
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {adding && !disabled ? (
            <View className="gap-2 rounded-2xl border border-[#E4DCF5] bg-white p-4">
              <ThemedText type="smallBold">{t('locations.drivers.newTitle')}</ThemedText>
              <TextField
                label={t('customer.fields.prenom')}
                value={newDriver.prenom}
                onChangeText={(v) => setNewDriver((prev) => ({ ...prev, prenom: v }))}
                error={touched && errors.prenom ? t('customer.form.errors.required') : undefined}
              />
              <TextField
                label={t('customer.fields.nom')}
                value={newDriver.nom}
                onChangeText={(v) => setNewDriver((prev) => ({ ...prev, nom: v }))}
                error={touched && errors.nom ? t('customer.form.errors.required') : undefined}
              />
              <TextField
                label={t('customer.fields.telephone')}
                value={newDriver.telephone}
                onChangeText={(v) => setNewDriver((prev) => ({ ...prev, telephone: v }))}
                keyboardType="phone-pad"
              />
              <TextField
                label={t('customer.fields.permis')}
                value={newDriver.numeroPermis}
                onChangeText={(v) => setNewDriver((prev) => ({ ...prev, numeroPermis: v }))}
                autoCapitalize="characters"
              />
              <TextField
                label={t('customer.fields.cin')}
                value={newDriver.cinOuPasseport}
                onChangeText={(v) => setNewDriver((prev) => ({ ...prev, cinOuPasseport: v }))}
                autoCapitalize="characters"
              />
              <ThemedText type="small" themeColor="textSecondary">
                {t('locations.drivers.newDocumentsHint')}
              </ThemedText>
              <View className="flex-row gap-2">
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setAdding(false);
                    setTouched(false);
                    setNewDriver(EMPTY_NEW_DRIVER);
                  }}
                />
                <Button label={t('locations.drivers.addNew')} size="sm" style={{ flex: 1 }} onPress={handleAddNew} />
              </View>
            </View>
          ) : !disabled ? (
            <Button
              label={t('locations.drivers.addNewButton')}
              variant="secondary"
              icon="person-add-outline"
              onPress={() => setAdding(true)}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
