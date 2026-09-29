import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { CustomerForm } from '@/features/customers/customer-form';
import { uploadCustomerDocument } from '@/features/customers/api';
import { mergeDocuments } from '@/features/customers/documents';
import { useCreateCustomer, useUpdateCustomerDocuments } from '@/features/customers/hooks';
import type { CustomerInput, PendingDocument } from '@/features/customers/types';
import { useLanguage } from '@/i18n/use-language';

export default function NouveauClientScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const createCustomer = useCreateCustomer();
  const updateDocuments = useUpdateCustomerDocuments();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(input: CustomerInput, pendingDocuments: PendingDocument[]) {
    if (!agencyQuery.data) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const customer = await createCustomer.mutateAsync({ agencyId: agencyQuery.data.agencyId, input });

      if (pendingDocuments.length > 0) {
        try {
          const uploaded = await Promise.all(
            pendingDocuments.map((doc) =>
              uploadCustomerDocument(agencyQuery.data!.agencyId, customer.id, doc.type, doc.localUri)
            )
          );
          await updateDocuments.mutateAsync({
            id: customer.id,
            documents: mergeDocuments(customer.documents, uploaded),
          });
        } catch {
          Alert.alert(t('common.appName'), t('customer.form.uploadError'));
          router.replace(`/clients/${customer.id}`);
          return;
        }
      }

      router.replace(`/clients/${customer.id}`);
    } catch {
      setSubmitError(t('customer.form.createError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('customer.form.newTitle')} showBack />
        <CustomerForm
          submitLabel={t('customer.form.save')}
          submittingLabel={t('customer.form.saving')}
          isSubmitting={isSubmitting}
          submitError={submitError}
          onSubmit={handleSubmit}
        />
      </SafeAreaView>
    </ThemedView>
  );
}
