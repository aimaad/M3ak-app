import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { useCreateContract } from '@/features/contracts/hooks';
import { useCustomer, useDrivers } from '@/features/customers/hooks';
import { useRental } from '@/features/rentals/hooks';
import { useVehicle } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

export default function NouveauContratScreen() {
  const { rentalId } = useLocalSearchParams<{ rentalId: string }>();
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const { data: rental, isLoading: isLoadingRental } = useRental(rentalId);
  const { data: vehicle } = useVehicle(rental?.vehicleId);
  const { data: customer } = useCustomer(rental?.customerId);
  const { data: drivers } = useDrivers(customer?.id);
  const createContract = useCreateContract();

  const [conditionsParticulieres, setConditionsParticulieres] = useState('');
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const driver = useMemo(
    () => (rental?.driverId ? (drivers ?? []).find((d) => d.id === rental.driverId) ?? null : null),
    [drivers, rental]
  );

  const isLoading = isLoadingRental || agencyQuery.isLoading;
  const canSubmit = !!rental && !!vehicle && !!customer && !!agencyQuery.data;

  async function handleSubmit() {
    if (!canSubmit || !rental || !vehicle || !customer || !agencyQuery.data) return;
    setSubmitError(null);

    try {
      const contract = await createContract.mutateAsync({
        agencyId: agencyQuery.data.agencyId,
        input: {
          rentalId: rental.id,
          conditionsParticulieres: conditionsParticulieres.trim() || null,
          notes: notes.trim() || null,
        },
        snapshot: {
          customerNom: customer.nomComplet,
          customerTelephone: customer.telephone,
          customerCin: customer.cinOuPasseport,
          driverNom: driver?.nomComplet ?? null,
          vehicleImmatriculation: vehicle.immatriculation,
          vehicleMarque: vehicle.marque,
          vehicleModele: vehicle.modele,
          dateDebutPrevue: rental.dateDebutPrevue,
          dateFinPrevue: rental.dateFinPrevue,
          prixTotal: rental.prixTotal,
          cautionMontant: rental.cautionMontant,
        },
      });
      router.replace(`/contrats/${contract.id}`);
    } catch (err) {
      console.error('Échec de création du contrat :', err);
      setSubmitError(t('contract.form.createError'));
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('contract.form.newTitle')} showBack />
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1f5eff" />
          </View>
        ) : !rental || !vehicle || !customer ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary">
              {t('locations.notFound')}
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
            <View className="rounded-3xl border border-[#e1e5f0] bg-white p-4 gap-1">
              <ThemedText type="smallBold">{`${vehicle.marque} ${vehicle.modele} · ${vehicle.immatriculation}`}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {customer.nomComplet}
                {driver ? ` · ${t('contract.driverLabel', { name: driver.nomComplet })}` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {rental.prixTotal != null ? `${rental.prixTotal.toLocaleString('fr-FR')} MAD` : '—'} · {t('locations.cautionBlocked')} {rental.cautionMontant.toLocaleString('fr-FR')} MAD
              </ThemedText>
            </View>

            <TextField
              label={t('contract.fields.conditionsParticulieres')}
              value={conditionsParticulieres}
              onChangeText={setConditionsParticulieres}
              multiline
              numberOfLines={3}
              className="min-h-20"
            />
            <TextField
              label={t('contract.fields.notes')}
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
              onPress={handleSubmit}
              disabled={createContract.isPending}
              className={`mt-2 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
                createContract.isPending ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
              }`}
            >
              {createContract.isPending ? <ActivityIndicator color="#ffffff" /> : null}
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                {createContract.isPending ? t('contract.form.saving') : t('contract.form.save')}
              </ThemedText>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
