import { useUndo } from '@/components/undo-toast';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card, PressableCard } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { InfoRow } from '@/components/info-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { CustomerDocumentsSection } from '@/features/customers/customer-documents-section';
import { CustomerNotesSection } from '@/features/customers/customer-notes-section';
import { DriverList } from '@/features/customers/driver-list';
import {
  useArchiveCustomer,
  useCustomer,
  useReactivateCustomer,
  useSetCustomerConsent,
} from '@/features/customers/hooks';
import { useSession } from '@/features/auth/session-context';
import { deriveRentalIncidents } from '@/features/rentals/incidents';
import { useCustomerRentals } from '@/features/rentals/hooks';
import { RentalStatusBadge } from '@/features/rentals/rental-status-badge';
import { useAllPayments } from '@/features/payments/hooks';
import { useLanguage } from '@/i18n/use-language';

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const { session } = useSession();
  const { data: customer, isLoading, isError } = useCustomer(id);
  const archiveCustomer = useArchiveCustomer();
  const reactivateCustomer = useReactivateCustomer();
  const { showUndo } = useUndo();
  const setConsent = useSetCustomerConsent();
  const { data: rentals = [] } = useCustomerRentals(customer?.id);
  const { data: allPayments = [] } = useAllPayments();

  const isManager = agencyQuery.data?.role === 'owner' || agencyQuery.data?.role === 'manager';

  const rentalIds = new Set(rentals.map((rental) => rental.id));
  const customerPayments = allPayments.filter((payment) => rentalIds.has(payment.rentalId));
  const incidents = deriveRentalIncidents(rentals);

  function handleToggleConsent() {
    if (!customer) return;
    setConsent.mutate({ id: customer.id, consent: !customer.consentementDonnees });
  }

  /** Archive tout de suite (réversible) puis laisse quelques secondes pour annuler. */
  function handleArchive() {
    if (!customer) return;
    const id = customer.id;
    archiveCustomer.mutate(id, {
      onSuccess: () =>
        showUndo({
          message: t('undoToast.customerArchived'),
          actionLabel: t('undoToast.undo'),
          onUndo: () => reactivateCustomer.mutateAsync(id),
          onUndoError: () => Alert.alert(t('common.appName'), t('undoToast.failed')),
        }),
      onError: () => Alert.alert(t('common.appName'), t('customer.archiveError')),
    });
  }

  function handleReactivate() {
    if (!customer) return;
    reactivateCustomer.mutate(customer.id, {
      onError: () => Alert.alert(t('common.appName'), t('customer.archiveError')),
    });
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={customer ? customer.nomComplet : t('customer.detailsTitle')}
          showBack
          right={
            customer ? (
              <Pressable onPress={() => router.push(`/clients/${customer.id}/modifier`)} hitSlop={8}>
                <ThemedText type="small" themeColor="primary">
                  {t('customer.edit')}
                </ThemedText>
              </Pressable>
            ) : undefined
          }
        />

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#7C3AED" />
          </View>
        ) : isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('customer.loadError')}
            </ThemedText>
          </View>
        ) : !customer ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary">
              {t('customer.notFound')}
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerClassName="gap-6 px-6 pb-10">
            <View className="flex-row items-center gap-2">
              <View className="rounded-full bg-[#EDE9FE] px-2.5 py-1">
                <ThemedText type="small" themeColor="primary">
                  {t(`customer.type.${customer.typeClient}`)}
                </ThemedText>
              </View>
              {customer.archivedAt ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('customer.archivedBadge')}
                </ThemedText>
              ) : null}
            </View>

            <View>
              <ThemedText type="smallBold" className="mb-2">
                {t('customer.sections.coordonnees')}
              </ThemedText>
              <Card padded={false} className="px-4">
                <InfoRow label={t('customer.fields.telephone')} value={customer.telephone ?? '—'} />
                <InfoRow label={t('customer.fields.telephoneSecondaire')} value={customer.telephoneSecondaire ?? '—'} />
                <InfoRow label={t('customer.fields.email')} value={customer.email ?? '—'} />
                <InfoRow label={t('customer.fields.adresse')} value={customer.adresse ?? '—'} />
                <InfoRow label={t('customer.fields.ville')} value={customer.ville ?? '—'} />
                <InfoRow label={t('customer.fields.cin')} value={customer.cinOuPasseport ?? '—'} />
                <View className="flex-row items-center justify-between py-3">
                  <ThemedText type="default" themeColor="textSecondary">
                    {t('customer.fields.permis')}
                  </ThemedText>
                  <ThemedText type="smallBold">{customer.numeroPermis ?? '—'}</ThemedText>
                </View>
              </Card>
            </View>

            {customer.typeClient === 'entreprise' ? (
              <View>
                <ThemedText type="smallBold" className="mb-2">
                  {t('customer.sections.type')}
                </ThemedText>
                <Card padded={false} className="px-4">
                  <InfoRow label={t('customer.fields.raisonSociale')} value={customer.raisonSociale ?? '—'} />
                  <View className="flex-row items-center justify-between py-3">
                    <ThemedText type="default" themeColor="textSecondary">
                      {t('customer.fields.ice')}
                    </ThemedText>
                    <ThemedText type="smallBold">{customer.ice ?? '—'}</ThemedText>
                  </View>
                </Card>
              </View>
            ) : null}

            <CustomerDocumentsSection
              agencyId={customer.agencyId}
              owner={{ kind: 'customer', id: customer.id }}
              canDelete={isManager}
            />

            <CustomerNotesSection
              agencyId={customer.agencyId}
              customerId={customer.id}
              role={agencyQuery.data?.role ?? null}
              userId={session?.user.id ?? null}
            />

            <View className="gap-3">
              <ThemedText type="smallBold">{t('customer.sections.conducteurs')}</ThemedText>
              <DriverList agencyId={customer.agencyId} customerId={customer.id} canRemove={isManager} />
            </View>

            <View className="gap-2">
              <ThemedText type="smallBold">{t('customer.historySection')}</ThemedText>
              {rentals.length === 0 ? (
                <View className="gap-1 rounded-3xl border border-dashed border-[#E4DCF5] bg-white p-4">
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('customer.historyPlaceholder')}
                  </ThemedText>
                </View>
              ) : (
                <View className="gap-2">
                  {rentals.map((rental) => (
                    <PressableCard
                      key={rental.id}
                      onPress={() => router.push(`/locations/${rental.id}`)}
                      padded={false}
                      className="gap-1 px-4 py-3"
                    >
                      <View className="flex-row items-center justify-between">
                        <ThemedText type="small">{rental.numero}</ThemedText>
                        <RentalStatusBadge status={rental.statut} />
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatShortDate(rental.dateDebutPrevue)} → {formatShortDate(rental.dateFinPrevue)}
                        {rental.prixTotal != null ? ` · ${rental.prixTotal.toLocaleString('fr-FR')} MAD` : ''}
                      </ThemedText>
                      {incidents.some((incident) => incident.rentalId === rental.id) ? (
                        <View className="flex-row flex-wrap gap-1 pt-1">
                          {incidents
                            .filter((incident) => incident.rentalId === rental.id)
                            .map((incident) => (
                              <View
                                key={incident.type}
                                className="rounded-full px-2 py-0.5"
                                style={{ backgroundColor: M3akPalette.dangerLight }}
                              >
                                <ThemedText type="small" style={{ color: M3akPalette.danger, fontSize: 11 }}>
                                  {t(`customer.incidents.${incident.type}`)}
                                </ThemedText>
                              </View>
                            ))}
                        </View>
                      ) : null}
                    </PressableCard>
                  ))}
                </View>
              )}
            </View>

            <View className="gap-2">
              <ThemedText type="smallBold">{t('customer.paymentsSection')}</ThemedText>
              {customerPayments.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('customer.noPayments')}
                </ThemedText>
              ) : (
                <View className="gap-2">
                  {customerPayments.map((payment) => (
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
            </View>

            <View className="gap-2">
              <ThemedText type="smallBold">{t('customer.consentSection')}</ThemedText>
              <Card padded={false} className="flex-row items-center justify-between px-4 py-3">
                <View className="flex-1 gap-0.5">
                  <ThemedText type="small">
                    {customer.consentementDonnees ? t('customer.consentGiven') : t('customer.consentMissing')}
                  </ThemedText>
                  {customer.consentementDonnees && customer.consentementDate ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('customer.consentDate', { date: formatShortDate(customer.consentementDate) })}
                    </ThemedText>
                  ) : null}
                </View>
                <Button
                  label={customer.consentementDonnees ? t('customer.consentRevoke') : t('customer.consentGive')}
                  variant={customer.consentementDonnees ? 'danger' : 'secondary'}
                  size="sm"
                  onPress={handleToggleConsent}
                  disabled={setConsent.isPending}
                />
              </Card>
            </View>

            {isManager ? (
              <Button
                label={customer.archivedAt ? t('customer.reactivate') : t('customer.archive')}
                variant={customer.archivedAt ? 'secondary' : 'danger'}
                onPress={customer.archivedAt ? handleReactivate : handleArchive}
              />
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
