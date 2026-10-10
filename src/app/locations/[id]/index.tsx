import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { useCancelRental, useConfirmRental, useRental } from '@/features/rentals/hooks';
import { RentalStatusBadge } from '@/features/rentals/rental-status-badge';
import { useVehicle } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-[#e1e5f0] py-3">
      <ThemedText type="default" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
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
  const cancelRental = useCancelRental();
  const confirmRental = useConfirmRental();

  const rentalConfirmed = rental?.statut === 'confirmee' || rental?.statut === 'reservee';
  const canCreateContract = rentalConfirmed && !contract;
  const canStart = rentalConfirmed && contract?.statut === 'signe';
  const canConfirm = rental?.statut === 'en_attente_confirmation';
  const canCancel = rental?.statut === 'en_attente_confirmation' || rental?.statut === 'confirmee' || rental?.statut === 'reservee';
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
              <ActivityIndicator color="#1f5eff" />
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

          <View className="rounded-3xl border border-[#e1e5f0] bg-white px-4">
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
          </View>

          {canConfirm ? (
            <Pressable
              onPress={handleConfirm}
              disabled={confirmRental.isPending}
              className="items-center rounded-2xl bg-[#1f5eff] px-4 py-4"
            >
              {confirmRental.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                  {t('locations.confirmAction')}
                </ThemedText>
              )}
            </Pressable>
          ) : null}

          <View className="gap-2">
            <ThemedText type="smallBold">{t('contract.section')}</ThemedText>
            {contract ? (
              <Pressable
                onPress={() => router.push(`/contrats/${contract.id}`)}
                className="flex-row items-center justify-between rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
              >
                <ThemedText type="small">{contract.numero}</ThemedText>
                <ContractStatusBadge status={contract.statut} />
              </Pressable>
            ) : canCreateContract ? (
              <Pressable
                onPress={() => router.push(`/contrats/nouveau?rentalId=${rental.id}`)}
                className="items-center rounded-2xl border border-[#1f5eff] px-4 py-3"
              >
                <ThemedText type="smallBold" themeColor="primary">
                  {t('contract.createAction')}
                </ThemedText>
              </Pressable>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {t('contract.unavailableHint')}
              </ThemedText>
            )}
          </View>

          <View className="gap-2">
            <ThemedText type="smallBold">{t('inspection.section')}</ThemedText>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/locations/[id]/inspection-depart',
                  params: { id: rental.id },
                })
              }
              className="flex-row items-center justify-between rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
            >
              <ThemedText type="small">{t('inspection.title.depart')}</ThemedText>
              <ThemedText type="small" themeColor={inspectionDepart?.statut === 'terminee' ? undefined : 'textSecondary'} style={inspectionDepart?.statut === 'terminee' ? { color: '#15803d' } : undefined}>
                {inspectionDepart?.statut === 'terminee' ? t('inspection.done') : t('inspection.todo')}
              </ThemedText>
            </Pressable>
            {rental.statut === 'en_cours' || rental.statut === 'terminee' ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/locations/[id]/inspection-retour',
                    params: { id: rental.id },
                  })
                }
                className="flex-row items-center justify-between rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
              >
                <ThemedText type="small">{t('inspection.title.retour')}</ThemedText>
                <ThemedText type="small" themeColor={inspectionRetour?.statut === 'terminee' ? undefined : 'textSecondary'} style={inspectionRetour?.statut === 'terminee' ? { color: '#15803d' } : undefined}>
                  {inspectionRetour?.statut === 'terminee' ? t('inspection.done') : t('inspection.todo')}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {canStart ? (
            <View className="gap-2">
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/locations/[id]/depart',
                    params: { id: rental.id, vehicleId: rental.vehicleId },
                  })
                }
                className="items-center rounded-2xl bg-[#1f5eff] px-4 py-4"
              >
                <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                  {t('locations.startAction')}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          {canCancel ? (
            <Pressable
              onPress={handleCancel}
              className="items-center rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
            >
              <ThemedText type="small" style={{ color: '#dc2626' }}>
                {t('locations.cancelAction')}
              </ThemedText>
            </Pressable>
          ) : null}

          {rental.statut === 'en_cours' ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/locations/[id]/retour',
                  params: { id: rental.id, vehicleId: rental.vehicleId },
                })
              }
              className="items-center rounded-2xl bg-[#1f5eff] px-4 py-4"
            >
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                {t('locations.completeAction')}
              </ThemedText>
            </Pressable>
          ) : null}

          <View className="gap-3">
            <ThemedText type="smallBold">{t('locations.cautionSection')}</ThemedText>
            {deposit ? (
              <>
                <View className="rounded-3xl border border-[#e1e5f0] bg-white px-4">
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
                </View>
                {rental.statut === 'terminee' && deposit.statut === 'bloquee' ? (
                  <DepositResolveForm deposit={deposit} />
                ) : null}
              </>
            ) : null}
          </View>

          {rental.notes ? (
            <View className="gap-2">
              <ThemedText type="smallBold">{t('locations.notes')}</ThemedText>
              <View className="rounded-3xl border border-[#e1e5f0] bg-white p-4">
                <ThemedText type="default">{rental.notes}</ThemedText>
              </View>
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
                  <View
                    key={payment.id}
                    className="flex-row items-center justify-between rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
                  >
                    <ThemedText type="small">{t(`locations.paymentMethods.${payment.methode}`)}</ThemedText>
                    <ThemedText type="smallBold">{`${payment.montant.toLocaleString('fr-FR')} MAD`}</ThemedText>
                  </View>
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
