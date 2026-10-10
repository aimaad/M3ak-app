import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentPreview } from '@/components/document-preview';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { DOCUMENTS_BUCKET } from '@/features/customers/api';
import { DriverList } from '@/features/customers/driver-list';
import { useArchiveCustomer, useCustomer, useReactivateCustomer } from '@/features/customers/hooks';
import { findDocument } from '@/features/storage/documents';
import { DOCUMENT_TYPES } from '@/features/customers/types';
import { useLanguage } from '@/i18n/use-language';

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

function isExpiringSoon(expiresAt: string | null, withinDays = 30): boolean {
  if (!expiresAt) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() + withinDays);
  return new Date(expiresAt).getTime() <= limit.getTime();
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const { data: customer, isLoading, isError } = useCustomer(id);
  const archiveCustomer = useArchiveCustomer();
  const reactivateCustomer = useReactivateCustomer();

  const isManager = agencyQuery.data?.role === 'owner' || agencyQuery.data?.role === 'manager';

  function handleArchive() {
    if (!customer) return;
    Alert.alert(t('customer.archiveConfirmTitle'), t('customer.archiveConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('customer.archive'),
        style: 'destructive',
        onPress: () => {
          archiveCustomer.mutate(customer.id, {
            onError: () => Alert.alert(t('common.appName'), t('customer.archiveError')),
          });
        },
      },
    ]);
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
              <View className="rounded-3xl border border-[#EAE5F2] bg-white px-4">
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
              </View>
            </View>

            {customer.typeClient === 'entreprise' ? (
              <View>
                <ThemedText type="smallBold" className="mb-2">
                  {t('customer.sections.type')}
                </ThemedText>
                <View className="rounded-3xl border border-[#EAE5F2] bg-white px-4">
                  <InfoRow label={t('customer.fields.raisonSociale')} value={customer.raisonSociale ?? '—'} />
                  <View className="flex-row items-center justify-between py-3">
                    <ThemedText type="default" themeColor="textSecondary">
                      {t('customer.fields.ice')}
                    </ThemedText>
                    <ThemedText type="smallBold">{customer.ice ?? '—'}</ThemedText>
                  </View>
                </View>
              </View>
            ) : null}

            {customer.notes ? (
              <View>
                <ThemedText type="smallBold" className="mb-2">
                  {t('customer.sections.notes')}
                </ThemedText>
                <View className="rounded-3xl border border-[#EAE5F2] bg-white p-4">
                  <ThemedText type="default">{customer.notes}</ThemedText>
                </View>
              </View>
            ) : null}

            <View className="gap-4">
              <ThemedText type="smallBold">{t('customer.documentsSection')}</ThemedText>
              {DOCUMENT_TYPES.map((type) => {
                const doc = findDocument(customer.documents, type);
                return (
                  <View key={type} className="gap-1">
                    <DocumentPreview
                      label={t(`customer.documents.${type}`)}
                      bucket={DOCUMENTS_BUCKET}
                      path={doc?.path}
                      emptyLabel={t('customer.noDocuments')}
                    />
                    {doc?.reference ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('customer.documentReference', { reference: doc.reference })}
                      </ThemedText>
                    ) : null}
                    {doc?.expiresAt ? (
                      <ThemedText type="small" style={{ color: isExpiringSoon(doc.expiresAt) ? '#DC2626' : '#81778F' }}>
                        {t('vehicle.documentExpiry', { date: new Date(doc.expiresAt).toLocaleDateString('fr-FR') })}
                      </ThemedText>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View className="gap-3">
              <ThemedText type="smallBold">{t('customer.sections.conducteurs')}</ThemedText>
              <DriverList agencyId={customer.agencyId} customerId={customer.id} canRemove={isManager} />
            </View>

            <View>
              <ThemedText type="smallBold" className="mb-2">
                {t('customer.historySection')}
              </ThemedText>
              <View className="gap-1 rounded-3xl border border-dashed border-[#EAE5F2] bg-white p-4">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('customer.historyPlaceholder')}
                </ThemedText>
              </View>
            </View>

            {isManager ? (
              <Pressable
                onPress={customer.archivedAt ? handleReactivate : handleArchive}
                className="items-center rounded-2xl border border-[#EAE5F2] bg-white px-4 py-4"
              >
                <ThemedText type="smallBold" themeColor={customer.archivedAt ? 'primary' : undefined}>
                  {customer.archivedAt ? t('customer.reactivate') : t('customer.archive')}
                </ThemedText>
              </Pressable>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
