import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CollapsibleSection } from '@/components/collapsible-section';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { useContractForRental } from '@/features/contracts/hooks';
import { useCustomer } from '@/features/customers/hooks';
import { useDeposit } from '@/features/deposits/hooks';
import { useInspectionForRental } from '@/features/inspections/hooks';
import { AddPaymentForm } from '@/features/payments/add-payment-form';
import { usePaymentsForRental } from '@/features/payments/hooks';
import { ExtendRentalForm } from '@/features/rentals/extend-rental-form';
import { RENTAL_CONFLICT_ERROR } from '@/features/rentals/api';
import { overlappingRentalIds } from '@/features/rentals/availability';
import { useCancelRental, useConfirmRental, useDepartureCheck, useDeparturePolicy, useRental, useVehicleRentals } from '@/features/rentals/hooks';
import { RentalDriversSection } from '@/features/rentals/rental-drivers-section';
import { OverlapBadge } from '@/features/rentals/overlap-badge';
import { RentalDossier } from '@/features/rentals/rental-dossier';
import { RentalJourney } from '@/features/rentals/rental-journey';
import { RentalStatusBadge } from '@/features/rentals/rental-status-badge';
import { useVehicle } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-[#E4DCF5] py-3">
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
  const vehicleRentalsQuery = useVehicleRentals(rental?.vehicleId);
  const { data: inspectionDepart } = useInspectionForRental(rental?.id, 'depart');
  const { data: inspectionRetour } = useInspectionForRental(rental?.id, 'retour');
  const { data: contract } = useContractForRental(rental?.id);
  const agencyQuery = useMyAgency();
  const departureCheck = useDepartureCheck(rentalConfirmedId(rental));
  const policyQuery = useDeparturePolicy(rental?.agencyId);
  const cancelRental = useCancelRental();
  const confirmRental = useConfirmRental();

  const driversEditable =
    rental?.statut === 'en_attente_confirmation' || rental?.statut === 'confirmee' || rental?.statut === 'reservee';
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
      onError: (error) =>
        Alert.alert(t('common.appName'), t(error instanceof Error && error.message === RENTAL_CONFLICT_ERROR ? 'locations.confirmConflict' : 'locations.confirmError')),
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
          {overlappingRentalIds(vehicleRentalsQuery.data ?? []).has(rental.id) ? (
            <View className="gap-1 rounded-2xl border border-[#FECACA] bg-[#FEE2E2] p-4">
              <OverlapBadge />
              <ThemedText type="small" style={{ color: '#991B1B' }}>
                {t('locations.overlap.warning')}
              </ThemedText>
            </View>
          ) : null}

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

          <RentalJourney
            rental={rental}
            role={agencyQuery.data?.role ?? null}
            contract={contract}
            inspectionDepart={inspectionDepart}
            inspectionRetour={inspectionRetour}
            deposit={deposit}
            departureCheck={departureCheck.data}
            payments={payments}
            onConfirm={handleConfirm}
            confirming={confirmRental.isPending}
          />

          <View className="gap-3">
            <ThemedText type="smallBold">{t('locations.dossier.title')}</ThemedText>
            <RentalDossier
              rental={rental}
              vehicle={vehicle}
              contract={contract}
              inspectionDepart={inspectionDepart}
              inspectionRetour={inspectionRetour}
              deposit={deposit}
              payments={payments}
            />
          </View>

          <View className="gap-3">
            <ThemedText type="smallBold">{t('locations.detailsSection')}</ThemedText>

            <CollapsibleSection title={t('locations.drivers.sectionTitle')}>
              <RentalDriversSection
                rental={rental}
                customer={customer ?? null}
                maxAdditional={policyQuery.data?.maxAdditionalDrivers}
                editable={driversEditable}
              />
            </CollapsibleSection>

            {canExtend ? (
              <CollapsibleSection title={t('locations.extend.title')}>
                <ExtendRentalForm rental={rental} />
              </CollapsibleSection>
            ) : null}

            {deposit ? (
              <CollapsibleSection title={t('locations.cautionSection')}>
                <Card padded={false} className="px-4">
                  <InfoRow label={t('locations.cautionBlocked')} value={`${deposit.montantBloque.toLocaleString('fr-FR')} MAD`} />
                  <InfoRow label={t('locations.cautionRetained')} value={`${deposit.montantRetenu.toLocaleString('fr-FR')} MAD`} />
                  <View className="flex-row items-center justify-between py-3">
                    <ThemedText type="default" themeColor="textSecondary">
                      {t('locations.cautionReturned')}
                    </ThemedText>
                    <ThemedText type="smallBold">{`${deposit.montantRestitue.toLocaleString('fr-FR')} MAD`}</ThemedText>
                  </View>
                </Card>
              </CollapsibleSection>
            ) : null}

            <CollapsibleSection title={t('locations.paymentsSection')} badge={payments.length > 0 ? String(payments.length) : undefined}>
              <View className="gap-3">
                {payments.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('locations.noPayments')}
                  </ThemedText>
                ) : (
                  <View className="gap-2">
                    {payments.map((payment) => (
                      <Card key={payment.id} padded={false} className="flex-row items-center justify-between px-4 py-3">
                        <ThemedText type="small">{t(`locations.paymentMethods.${payment.methode}`)}</ThemedText>
                        <ThemedText type="smallBold">{`${payment.montant.toLocaleString('fr-FR')} MAD`}</ThemedText>
                      </Card>
                    ))}
                  </View>
                )}
                <AddPaymentForm agencyId={rental.agencyId} rentalId={rental.id} />
              </View>
            </CollapsibleSection>

            {rental.notes ? (
              <CollapsibleSection title={t('locations.notes')}>
                <ThemedText type="default">{rental.notes}</ThemedText>
              </CollapsibleSection>
            ) : null}
          </View>

          {canCancel ? <Button label={t('locations.cancelAction')} variant="danger" onPress={handleCancel} /> : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
