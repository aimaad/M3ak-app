import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCustomer } from '@/features/customers/hooks';
import { DepositResolveForm } from '@/features/deposits/deposit-resolve-form';
import { useDeposit } from '@/features/deposits/hooks';
import { useInspectionForRental } from '@/features/inspections/hooks';
import { AddPaymentForm } from '@/features/payments/add-payment-form';
import { usePaymentsForRental } from '@/features/payments/hooks';
import { useCancelRental, useRental } from '@/features/rentals/hooks';
import { RentalStatusBadge } from '@/features/rentals/rental-status-badge';
import { useVehicle } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
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
  const { data: rental, isLoading } = useRental(id);
  const { data: vehicle } = useVehicle(rental?.vehicleId);
  const { data: customer } = useCustomer(rental?.customerId);
  const { data: deposit } = useDeposit(rental?.id);
  const { data: payments = [] } = usePaymentsForRental(rental?.id);
  const { data: inspectionDepart } = useInspectionForRental(rental?.id, 'depart');
  const { data: inspectionRetour } = useInspectionForRental(rental?.id, 'retour');
  const cancelRental = useCancelRental();

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

  if (isLoading || !rental) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('locations.detailsTitle')} showBack />
          <View className="flex-1 items-center justify-center">
            {isLoading ? (
              <ActivityIndicator color="#1f5eff" />
            ) : (
              <ThemedText type="default" themeColor="textSecondary">
                {t('locations.notFound')}
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
          <RentalStatusBadge status={rental.statut} />

          <View className="rounded-3xl border border-[#e1e5f0] bg-white px-4">
            <InfoRow label={t('locations.vehicle')} value={vehicle ? vehicle.immatriculation : '—'} />
            <InfoRow label={t('locations.customer')} value={customer?.nomComplet ?? '—'} />
            <InfoRow
              label={t('locations.period')}
              value={`${formatDate(rental.dateDebutPrevue)} → ${formatDate(rental.dateFinPrevue)}`}
            />
            <View className="flex-row items-center justify-between py-3">
              <ThemedText type="default" themeColor="textSecondary">
                {t('locations.prixTotal')}
              </ThemedText>
              <ThemedText type="smallBold" themeColor="primary">
                {rental.prixTotal != null ? `${rental.prixTotal.toLocaleString('fr-FR')} MAD` : '—'}
              </ThemedText>
            </View>
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

          {rental.statut === 'reservee' ? (
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
              <Pressable
                onPress={handleCancel}
                className="items-center rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
              >
                <ThemedText type="small" style={{ color: '#dc2626' }}>
                  {t('locations.cancelAction')}
                </ThemedText>
              </Pressable>
            </View>
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
