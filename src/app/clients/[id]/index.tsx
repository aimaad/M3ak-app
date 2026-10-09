import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentPreview } from '@/components/document-preview';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DOCUMENTS_BUCKET } from '@/features/customers/api';
import { findDocument } from '@/features/storage/documents';
import { useCustomer } from '@/features/customers/hooks';
import type { DocumentType } from '@/features/customers/types';
import { useLanguage } from '@/i18n/use-language';

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

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: customer, isLoading } = useCustomer(id);

  const documentTypes: DocumentType[] = ['cin', 'permis'];

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
            <ActivityIndicator color="#1f5eff" />
          </View>
        ) : !customer ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary">
              {t('customer.notFound')}
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerClassName="gap-6 px-6 pb-10">
            <View>
              <ThemedText type="smallBold" className="mb-2">
                {t('customer.infoSection')}
              </ThemedText>
              <View className="rounded-3xl border border-[#e1e5f0] bg-white px-4">
                <InfoRow label={t('customer.fields.telephone')} value={customer.telephone ?? '—'} />
                <InfoRow label={t('customer.fields.email')} value={customer.email ?? '—'} />
                <InfoRow label={t('customer.fields.cin')} value={customer.cinOuPasseport ?? '—'} />
                <View className="flex-row items-center justify-between py-3">
                  <ThemedText type="default" themeColor="textSecondary">
                    {t('customer.fields.permis')}
                  </ThemedText>
                  <ThemedText type="smallBold">{customer.numeroPermis ?? '—'}</ThemedText>
                </View>
              </View>
            </View>

            <View className="gap-4">
              <ThemedText type="smallBold">{t('customer.documentsSection')}</ThemedText>
              {documentTypes.map((type) => (
                <DocumentPreview
                  key={type}
                  label={t(`customer.documents.${type}`)}
                  bucket={DOCUMENTS_BUCKET}
                  path={findDocument(customer.documents, type)?.path}
                  emptyLabel={t('customer.noDocuments')}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
