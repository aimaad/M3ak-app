import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card, PressableCard } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useContractForRental } from '@/features/contracts/hooks';
import { ContractStatusBadge } from '@/features/contracts/contract-status-badge';
import { useCustomer } from '@/features/customers/hooks';
import { DepositResolveForm } from '@/features/deposits/deposit-resolve-form';
import { useDeposit } from '@/features/deposits/hooks';
import { useInspectionForRental } from '@/features/inspections/hooks';
import { AddPaymentForm } from '@/features/payments/add-payment-form';
import { usePaymentsForRental } from '@/features/payments/hooks';
import { ExtendRentalForm } from '@/features/rentals/extend-rental-form';
import { useMyAgency } from '@/features/agency/hooks';
import { DepartureChecklist } from '@/features/rentals/departure-checklist';
import { useCancelRental, useConfirmRental, useDepartureCheck, useDeparturePolicy, useRental } from '@/features/rentals/hooks';
import { RentalDriversSection } from '@/features/rentals/rental-drivers-section';
import { RentalStatusBadge } from '@/features/rentals/rental-status-badge';
import { useVehicle } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-[#EAE5F2] py-3">
      <ThemedText type="default" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

/** La liste de contrôle n'a de sens que tant que le départ n'est pas enregistré. */
function rentalConfirmedId(rental: { id: string; statut: string } | null | undefined): string | undefined {
  return rental && (rental.statut === 'confirmee' || rental.statut === 'reservee') ? rental.id : undefined;
}

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: rental, isLoading, isError } = useRental(id);
  const { data: vehicle } = useVehicle(rental?.vehicleId);
  const { data: customer } = useCustomer(rental?.customerId);
  const { data: deposit } = useDeposit(rental?.id);
  const { data: payments = [] } = usePaymentsForRental(rental?.id);
  const { data: inspectionDepart } = useInspectionForRental(rental?.id, 'depart');
  const { data: inspectionRetour } = useInspectionForRental(rental?.id, 'retour');
  const { data: contract } = useContractForRental(rental?.id);
  const agencyQuery = useMyAgency();
  const departureCheck = useDepartureCheck(rentalConfirmedId(rental));
  const policyQuery = useDeparturePolicy(rental?.agencyId);
  const cancelRental = useCancelRental();
  const confirmRental = useConfirmRental();

  const rentalConfirmed = rental?.statut === 'confirmee' || rental?.statut === 'reservee';
  const canCreateContract = rentalConfirmed && !contract;
  const departureBlocked = !!departureCheck.data && departureCheck.data.enforced && !departureCheck.data.ok;
  const canStart = rentalConfirmed && contract?.statut === 'signe' && !departureBlocked;
  const driversEditable =
    rental?.statut === 'en_attente_confirmation' || rental?.statut === 'confirmee' || rental?.statut === 'reservee';
  const canConfirm = rental?.statut === 'en_attente_confirmation';
  const canCancel = rental?.statut === 'en_attente_confirmation' || rental?.statut === 'confirmee' || rental?.statut === 'reservee';
  const canExtend =
    rental?.statut === 'en_attente_confirmation' ||
    rental?.statut === 'confirmee' ||
    rental?.statut === 'reservee' ||
    rental?.statut === 'en_cours';
  const soldeRestant = rental ? Math.max(0, (rental.prixTotal ?? 0) - rental.acomptePaye) : 0;

  async function handleCancel() {
    if (!rental) return;
    Alert.alert(t('locations.cancelAction'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('locations.cancelAction'),
        style: 'destructive',
        onPress: () => cancelRental.mutate(rental.id),
      },
    ]);
  }

  function handleConfirm() {
    if (!rental) return;
    confirmRental.mutate(rental.id, {
      onError: () => Alert.alert(t('common.appName'), t('locations.confirmError')),
    });
  }

  if (isLoading || isError || !rental) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('locations.detailsTitle')} showBack />
          <View className="flex-1 items-center justify-center px-8">
            {isLoading ? (
              <ActivityIndicator color="#7C3AED" />
            ) : (
              <ThemedText type="default" themeColor="textSecondary" className="text-center">
                {isError ? t('locations.loadError') : t('locations.notFound')}
              </ThemedText>
            )}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={vehicle ? `${vehicle.marque} ${vehicle.modele}` : t('locations.unknownVehicle')}
          showBack
        />

        <ScrollView contentContainerClassName="gap-6 px-6 pb-10">
          <View className="flex-row items-center justify-between">
            <RentalStatusBadge status={rental.statut} />
            <ThemedText type="small" themeColor="textSecondary">
              {rental.numero}
            </ThemedText>
          </View>

          <Card padded={false} className="px-4">
            <InfoRow label={t('locations.vehicle')} value={vehicle ? vehicle.immatriculation : '—'} />
            <InfoRow label={t('locations.customer')} value={customer?.nomComplet ?? '—'} />
            <InfoRow
              label={t('locations.period')}
              value={`${formatDateTime(rental.dateDebutPrevue)} → ${formatDateTime(rental.dateFinPrevue)}`}
            />
            {rental.lieuDepart ? <InfoRow label={t('locations.lieuDepart')} value={rental.lieuDepart} /> : null}
            {rental.lieuRetour ? <InfoRow label={t('locations.lieuRetour')} value={rental.lieuRetour} /> : null}
            <View className="flex-row items-center justify-between py-3">
              <ThemedText type="default" themeColor="textSecondary">
                {t('locations.prixTotal')}
              </ThemedText>
              <ThemedText type="smallBold" themeColor="primary">
                {rental.prixTotal != null ? `${rental.prixTotal.toLocaleString('fr-FR')} MAD` : '—'}
              </ThemedText>
            </View>
            <InfoRow label={t('locations.soldeRestant')} value={`${soldeRestant.toLocaleString('fr-FR')} MAD`} />
          </Card>

          {canExtend ? <ExtendRentalForm rental={rental} /> : null}

          <RentalDriversSection
            rental={rental}
            customer={customer ?? null}
            maxAdditional={policyQuery.data?.maxAdditionalDrivers}
            editable={driversEditable}
          />

          {rentalConfirmed ? (
            <DepartureChecklist rentalId={rental.id} customerId={rental.customerId} role={agencyQuery.data?.role ?? null} />
          ) : null}

          {canConfirm ? (
            <Button label={t('locations.confirmAction')} onPress={handleConfirm} loading={confirmRental.isPending} />
          ) : null}

          <View className="gap-2">
            <ThemedText type="smallBold">{t('contract.section')}</ThemedText>
            {contract ? (
              <PressableCard
                onPress={() => router.push(`/contrats/${contract.id}`)}
                padded={false}
                className="flex-row items-center justify-between px-4 py-3"
              >
                <ThemedText type="small">{contract.numero}</ThemedText>
                <ContractStatusBadge status={contract.statut} />
              </PressableCard>
            ) : canCreateContract ? (
              <Button
                label={t('contract.createAction')}
                variant="secondary"
                onPress={() => router.push(`/contrats/nouveau?rentalId=${rental.id}`)}
              />
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {t('contract.unavailableHint')}
              </ThemedText>
            )}
          </View>

          <View className="gap-2">
            <ThemedText type="smallBold">{t('inspection.section')}</ThemedText>
            <PressableCard
              onPress={() =>
                router.push({
                  pathname: '/locations/[id]/inspection-depart',
                  params: { id: rental.id },
                })
              }
              padded={false}
              className="flex-row items-center justify-between px-4 py-3"
            >
              <ThemedText type="small">{t('inspection.title.depart')}</ThemedText>
              <ThemedText type="small" themeColor={inspectionDepart?.statut === 'terminee' ? undefined : 'textSecondary'} style={inspectionDepart?.statut === 'terminee' ? { color: '#15803D' } : undefined}>
                {inspectionDepart?.statut === 'terminee' ? t('inspection.done') : t('inspection.todo')}
              </ThemedText>
            </PressableCard>
            {rental.statut === 'en_cours' || rental.statut === 'terminee' ? (
              <PressableCard
                onPress={() =>
                  router.push({
                    pathname: '/locations/[id]/inspection-retour',
                    params: { id: rental.id },
                  })
                }
                padded={false}
                className="flex-row items-center justify-between px-4 py-3"
              >
                <ThemedText type="small">{t('inspection.title.retour')}</ThemedText>
                <ThemedText type="small" themeColor={inspectionRetour?.statut === 'terminee' ? undefined : 'textSecondary'} style={inspectionRetour?.statut === 'terminee' ? { color: '#15803D' } : undefined}>
                  {inspectionRetour?.statut === 'terminee' ? t('inspection.done') : t('inspection.todo')}
                </ThemedText>
              </PressableCard>
            ) : null}
            {inspectionDepart?.statut === 'terminee' ? (
              <PressableCard
                onPress={() => router.push({ pathname: '/locations/[id]/inspection-analyse', params: { id: rental.id, type: 'depart' } })}
                padded={false}
                className="flex-row items-center justify-between px-4 py-3"
              >
                <ThemedText type="small">{t('inspection.openReport')} — {t('inspection.analysis.compare.depart')}</ThemedText>
              </PressableCard>
            ) : null}
            {inspectionRetour?.statut === 'terminee' ? (
              <PressableCard
                onPress={() => router.push({ pathname: '/locations/[id]/inspection-analyse', params: { id: rental.id, type: 'retour' } })}
                padded={false}
                className="flex-row items-center justify-between px-4 py-3"
              >
                <ThemedText type="small">{t('inspection.openReport')} — {t('inspection.analysis.compare.retour')}</ThemedText>
              </PressableCard>
            ) : null}
          </View>

          {rentalConfirmed && contract?.statut === 'signe' && departureBlocked ? (
            <ThemedText type="small" style={{ color: '#DC2626' }}>
              {t('locations.departureCheck.startBlocked')}
            </ThemedText>
          ) : null}

          {canStart ? (
            <Button
              label={t('locations.startAction')}
              onPress={() =>
                router.push({
                  pathname: '/locations/[id]/depart',
                  params: { id: rental.id, vehicleId: rental.vehicleId },
                })
              }
            />
          ) : null}

          {canCancel ? <Button label={t('locations.cancelAction')} variant="danger" onPress={handleCancel} /> : null}

          {rental.statut === 'en_cours' ? (
            <Button
              label={t('locations.completeAction')}
              onPress={() =>
                router.push({
                  pathname: '/locations/[id]/retour',
                  params: { id: rental.id, vehicleId: rental.vehicleId },
                })
              }
            />
          ) : null}

          <View className="gap-3">
            <ThemedText type="smallBold">{t('locations.cautionSection')}</ThemedText>
            {deposit ? (
              <>
                <Card padded={false} className="px-4">
                  <InfoRow
                    label={t('locations.cautionBlocked')}
                    value={`${deposit.montantBloque.toLocaleString('fr-FR')} MAD`}
                  />
                  <InfoRow
                    label={t('locations.cautionRetained')}
                    value={`${deposit.montantRetenu.toLocaleString('fr-FR')} MAD`}
                  />
                  <View className="flex-row items-center justify-between py-3">
                    <ThemedText type="default" themeColor="textSecondary">
                      {t('locations.cautionReturned')}
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {`${deposit.montantRestitue.toLocaleString('fr-FR')} MAD`}
                    </ThemedText>
                  </View>
                </Card>
                {rental.statut === 'terminee' && deposit.statut === 'bloquee' ? (
                  <DepositResolveForm deposit={deposit} />
                ) : null}
              </>
            ) : null}
          </View>

          {rental.notes ? (
            <View className="gap-2">
              <ThemedText type="smallBold">{t('locations.notes')}</ThemedText>
              <Card>
                <ThemedText type="default">{rental.notes}</ThemedText>
              </Card>
            </View>
          ) : null}

          <View className="gap-3">
            <ThemedText type="smallBold">{t('locations.paymentsSection')}</ThemedText>
            {payments.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('locations.noPayments')}
              </ThemedText>
            ) : (
              <View className="gap-2">
                {payments.map((payment) => (
                  <Card
                    key={payment.id}
                    padded={false}
                    className="flex-row items-center justify-between px-4 py-3"
                  >
                    <ThemedText type="small">{t(`locations.paymentMethods.${payment.methode}`)}</ThemedText>
                    <ThemedText type="smallBold">{`${payment.montant.toLocaleString('fr-FR')} MAD`}</ThemedText>
                  </Card>
                ))}
              </View>
            )}
            <AddPaymentForm agencyId={rental.agencyId} rentalId={rental.id} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
