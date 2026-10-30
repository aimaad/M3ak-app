import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { candidateFromDriver } from '@/features/customers/driver-candidates';
import { useCustomers } from '@/features/customers/hooks';
import type { Customer } from '@/features/customers/types';
import { useLanguage } from '@/i18n/use-language';

import { getDriverById } from './drivers-api';
import { useRentalAdditionalDrivers, useSaveRentalDrivers } from './hooks';
import { EMPTY_DRIVERS_SELECTION, hasOtherDrivers, rentalDriversErrorKey, type RentalDriversSelection } from './rental-drivers';
import { RentalDriversEditor } from './rental-drivers-editor';
import type { Rental } from './types';

/**
 * Conducteurs d'une réservation existante : client contractuel, conducteur principal, conducteurs
 * supplémentaires. Modifiable tant que la location n'a pas commencé.
 */
export function RentalDriversSection({
  rental,
  customer,
  maxAdditional,
  editable,
}: {
  rental: Rental;
  customer: Customer | null;
  maxAdditional?: number;
  editable: boolean;
}) {
  const { t } = useLanguage();
  const customersQuery = useCustomers();
  const additionalQuery = useRentalAdditionalDrivers(rental.id);
  const principalQuery = useQuery({
    queryKey: ['driver', rental.driverId],
    queryFn: () => getDriverById(rental.driverId as string),
    enabled: !!rental.driverId,
  });
  const save = useSaveRentalDrivers();

  const customers = customersQuery.data;
  const current = useMemo<RentalDriversSelection>(() => {
    if (!customers) return EMPTY_DRIVERS_SELECTION;
    return {
      principal: principalQuery.data ? candidateFromDriver(principalQuery.data, customers) : null,
      additional: (additionalQuery.data ?? []).map((driver) => candidateFromDriver(driver, customers)),
    };
  }, [customers, principalQuery.data, additionalQuery.data]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RentalDriversSelection>(EMPTY_DRIVERS_SELECTION);

  const loading = customersQuery.isLoading || additionalQuery.isLoading || (!!rental.driverId && principalQuery.isLoading);

  async function handleSave() {
    try {
      await save.mutateAsync({ agencyId: rental.agencyId, customerId: rental.customerId, rentalId: rental.id, selection: draft });
      setEditing(false);
    } catch (error) {
      Alert.alert(t('common.appName'), t(rentalDriversErrorKey(error)));
    }
  }

  return (
    <View className="gap-2">
      <ThemedText type="smallBold">{t('locations.drivers.sectionTitle')}</ThemedText>

      {editing ? (
        <View className="gap-3">
          <RentalDriversEditor customer={customer} value={draft} onChange={setDraft} maxAdditional={maxAdditional} disabled={save.isPending} />
          <View className="flex-row gap-2">
            <Button label={t('common.cancel')} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setEditing(false)} disabled={save.isPending} />
            <Button
              label={save.isPending ? t('customer.form.saving') : t('customer.form.save')}
              size="sm"
              style={{ flex: 1 }}
              onPress={handleSave}
              disabled={save.isPending}
              loading={save.isPending}
            />
          </View>
        </View>
      ) : (
        <Card className="gap-2">
          <View className="gap-0.5">
            <ThemedText type="small" themeColor="textSecondary">
              {t('locations.drivers.contractCustomer')}
            </ThemedText>
            <ThemedText type="smallBold">{customer?.nomComplet ?? '—'}</ThemedText>
          </View>
          <View className="gap-0.5">
            <ThemedText type="small" themeColor="textSecondary">
              {t('locations.drivers.principal')}
            </ThemedText>
            <ThemedText type="smallBold">
              {loading ? '…' : current.principal ? current.principal.nomComplet : `${customer?.nomComplet ?? '—'} (${t('locations.drivers.theClient')})`}
            </ThemedText>
          </View>
          {current.additional.length > 0 ? (
            <View className="gap-0.5">
              <ThemedText type="small" themeColor="textSecondary">
                {t('locations.drivers.additionalTitle')}
              </ThemedText>
              {current.additional.map((candidate) => (
                <ThemedText key={candidate.key} type="smallBold">
                  {candidate.nomComplet}
                </ThemedText>
              ))}
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {t('locations.drivers.noneAdditional')}
            </ThemedText>
          )}
          {editable ? (
            <Button
              label={hasOtherDrivers(current) ? t('locations.drivers.edit') : t('locations.drivers.addDrivers')}
              variant="secondary"
              size="sm"
              disabled={loading}
              onPress={() => {
                setDraft(current);
                setEditing(true);
              }}
            />
          ) : null}
        </Card>
      )}
    </View>
  );
}
