import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { useCreateContract } from '@/features/contracts/hooks';
import { buildSnapshotValues, departureSnapshotValues } from '@/features/contracts/snapshot';
import { ACCESSORY_KEYS, VEHICLE_CONDITIONS, type AccessoryKey, type VehicleCondition } from '@/features/contracts/types';
import { useCustomer, useDrivers } from '@/features/customers/hooks';
import { getDriverById } from '@/features/rentals/drivers-api';
import { contractDamageCandidates, damageLine } from '@/features/inspections/damage-text';
import { useInspectionDamages, useInspectionForRental } from '@/features/inspections/hooks';
import { useRental, useRentalAdditionalDrivers } from '@/features/rentals/hooks';
import { useVehicle } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

export default function NouveauContratScreen() {
  const { rentalId } = useLocalSearchParams<{ rentalId: string }>();
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const { data: rental, isLoading: isLoadingRental, isError: isRentalError } = useRental(rentalId);
  const { data: vehicle, isError: isVehicleError } = useVehicle(rental?.vehicleId);
  const { data: customer, isError: isCustomerError } = useCustomer(rental?.customerId);
  const { data: drivers } = useDrivers(customer?.id);
  const { data: additionalDrivers } = useRentalAdditionalDrivers(rental?.id);
  const createContract = useCreateContract();
  const { data: inspectionDepart } = useInspectionForRental(rental?.id, 'depart');
  const { data: departDamages = [] } = useInspectionDamages(inspectionDepart?.id);

  const [conditionsParticulieres, setConditionsParticulieres] = useState('');
  const [notes, setNotes] = useState('');
  // État des lieux au départ : repris de l'inspection de départ, que l'employé complète avant de faire signer.
  // Par défaut chaque dommage suit le choix fait à l'inspection (« inscrire au contrat ») ; ici l'employé peut l'inverser.
  const [flipped, setFlipped] = useState<string[]>([]);
  const [writtenDamage, setWrittenDamage] = useState('');
  const [kmDepart, setKmDepart] = useState<string | null>(null);
  const [carburantDepart, setCarburantDepart] = useState<string | null>(null);
  const [etatDepart, setEtatDepart] = useState<VehicleCondition | null>(null);
  const [accessoires, setAccessoires] = useState<AccessoryKey[]>([]);
  const [observations, setObservations] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const driver = useMemo(
    () => (rental?.driverId ? (drivers ?? []).find((d) => d.id === rental.driverId) ?? null : null),
    [drivers, rental]
  );
  // Un conducteur principal rattaché à un autre client n'est pas dans la liste des conducteurs du client réservant.
  const { data: principalDriver } = useQuery({
    queryKey: ['driver', rental?.driverId],
    queryFn: () => getDriverById(rental?.driverId as string),
    enabled: !!rental?.driverId && !driver,
  });
  const principalName = driver?.nomComplet ?? principalDriver?.nomComplet ?? null;

  const inspectionDone = inspectionDepart?.statut === 'terminee' || inspectionDepart?.statut === 'validee';
  const candidates = contractDamageCandidates(departDamages);
  const isIncluded = (damage: { id: string; dansContrat: boolean }) => damage.dansContrat !== flipped.includes(damage.id);
  const kmValue = kmDepart ?? (inspectionDepart?.kilometrage != null ? String(inspectionDepart.kilometrage) : '');
  const carburantValue = carburantDepart ?? (inspectionDepart?.niveauCarburant != null ? String(inspectionDepart.niveauCarburant) : '');
  const toNumber = (value: string) => (value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.round(Number(value)) : null);

  const isLoading = isLoadingRental || agencyQuery.isLoading;
  const isError = isRentalError || isVehicleError || isCustomerError || agencyQuery.isError;
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
          driverNom: principalName,
          autresConducteurs: (additionalDrivers ?? []).map((d) => d.nomComplet),
          vehicleImmatriculation: vehicle.immatriculation,
          vehicleMarque: vehicle.marque,
          vehicleModele: vehicle.modele,
          dateDebutPrevue: rental.dateDebutPrevue,
          dateFinPrevue: rental.dateFinPrevue,
          prixTotal: rental.prixTotal,
          cautionMontant: rental.cautionMontant,
          snapshotValues: {
            ...buildSnapshotValues(customer, additionalDrivers ?? []),
            ...departureSnapshotValues({
              km: toNumber(kmValue),
              carburant: toNumber(carburantValue),
              damages: candidates.filter(isIncluded).map((damage) => damageLine(damage, t)),
              written: writtenDamage,
            }),
          },
          departure: { etatDepart, accessoiresDepart: accessoires, observationsDepart: observations.trim() || null },
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
            <ActivityIndicator color="#7C3AED" />
          </View>
        ) : isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('locations.loadError')}
            </ThemedText>
          </View>
        ) : !rental || !vehicle || !customer ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary">
              {t('locations.notFound')}
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
            <Card className="gap-1">
              <ThemedText type="smallBold">{`${vehicle.marque} ${vehicle.modele} · ${vehicle.immatriculation}`}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {customer.nomComplet}
                {principalName ? ` · ${t('contract.driverLabel', { name: principalName })}` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {rental.prixTotal != null ? `${rental.prixTotal.toLocaleString('fr-FR')} MAD` : '—'} · {t('locations.cautionBlocked')} {rental.cautionMontant.toLocaleString('fr-FR')} MAD
              </ThemedText>
            </Card>

            <View className="gap-3">
              <ThemedText type="smallBold">{t('contract.form.departureTitle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('contract.form.departureHelp')}
              </ThemedText>
              {!inspectionDone ? (
                <View className="gap-2 rounded-2xl px-4 py-3" style={{ backgroundColor: '#FEF3C7' }}>
                  <ThemedText type="small" style={{ color: '#92400E' }}>
                    {t('contract.form.inspectionFirst')}
                  </ThemedText>
                  <Button
                    label={t('locations.departInspectionRequired.action')}
                    size="sm"
                    onPress={() => router.push({ pathname: '/locations/[id]/inspection-depart', params: { id: rental.id } })}
                  />
                </View>
              ) : null}

              <View className="flex-row gap-2">
                <TextField label={t('locations.depart.kilometrage')} value={kmValue} onChangeText={setKmDepart} keyboardType="number-pad" className="flex-1" />
                <TextField label={t('locations.depart.carburant')} value={carburantValue} onChangeText={setCarburantDepart} keyboardType="number-pad" className="flex-1" />
              </View>

              <View className="gap-1.5">
                <ThemedText type="small" themeColor="textSecondary">{t('contract.fields.etatGeneral')}</ThemedText>
                <View className="flex-row flex-wrap gap-2">
                  {VEHICLE_CONDITIONS.map((condition) => {
                    const selected = etatDepart === condition;
                    return (
                      <Pressable
                        key={condition}
                        onPress={() => setEtatDepart(condition)}
                        className={`rounded-full border px-4 py-2 ${selected ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'}`}
                      >
                        <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#211A2E' }}>{t(`contract.condition.${condition}`)}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="gap-1.5">
                <ThemedText type="small" themeColor="textSecondary">{t('contract.fields.accessoires')}</ThemedText>
                <View className="flex-row flex-wrap gap-2">
                  {ACCESSORY_KEYS.map((key) => {
                    const selected = accessoires.includes(key);
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setAccessoires((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]))}
                        className={`rounded-full border px-4 py-2 ${selected ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'}`}
                      >
                        <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#211A2E' }}>{t(`contract.accessory.${key}`)}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="gap-2">
                <ThemedText type="small" themeColor="textSecondary">{t('contract.form.damagesTitle')}</ThemedText>
                {inspectionDone && candidates.length === 0 ? (
                  <ThemedText type="small" style={{ color: '#15803D' }}>{t('contract.form.noDamages')}</ThemedText>
                ) : null}
                {candidates.map((damage) => {
                  const included = isIncluded(damage);
                  return (
                    <Pressable
                      key={damage.id}
                      onPress={() => setFlipped((prev) => (prev.includes(damage.id) ? prev.filter((id) => id !== damage.id) : [...prev, damage.id]))}
                      className="flex-row items-center gap-3 rounded-2xl border border-[#EAE5F2] bg-white px-4 py-3"
                      accessibilityRole="switch"
                      accessibilityState={{ checked: included }}
                    >
                      <View className="h-6 w-6 items-center justify-center rounded-md border-2" style={{ borderColor: M3akPalette.mauve, backgroundColor: included ? M3akPalette.mauve : '#fff' }}>
                        {included ? <ThemedText type="smallBold" style={{ color: '#fff', lineHeight: 18 }}>✓</ThemedText> : null}
                      </View>
                      <View className="flex-1">
                        <ThemedText type="small">{damageLine(damage, t)}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                          {included ? t('contract.form.inContract') : t('contract.form.notInContract')}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
                <TextField
                  label={t('contract.form.writtenDamage')}
                  value={writtenDamage}
                  onChangeText={setWrittenDamage}
                  placeholder={t('contract.form.writtenDamagePlaceholder')}
                  multiline
                  numberOfLines={3}
                  className="min-h-20"
                />
              </View>

              <TextField label={t('contract.fields.observations')} value={observations} onChangeText={setObservations} multiline numberOfLines={2} className="min-h-16" />
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
              <ThemedText type="small" style={{ color: '#DC2626' }}>
                {submitError}
              </ThemedText>
            ) : null}

            <Button
              label={createContract.isPending ? t('contract.form.saving') : t('contract.form.save')}
              onPress={handleSubmit}
              disabled={createContract.isPending}
              loading={createContract.isPending}
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
