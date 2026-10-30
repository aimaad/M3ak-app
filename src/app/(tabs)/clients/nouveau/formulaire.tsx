import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { takeCustomerCreationDraft } from '@/features/customers/customer-creation-draft';
import { CustomerForm } from '@/features/customers/customer-form';
import { addPendingDocuments } from '@/features/customers/documents-api';
import { useCreateCustomer, useCustomers } from '@/features/customers/hooks';
import type { CustomerInput, PendingDocument } from '@/features/customers/types';
import { useLanguage } from '@/i18n/use-language';

/** Formulaire de création, prérempli par le scan du permis (modifiable) ou vide en saisie manuelle. */
export default function FormulaireNouveauClientScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const customersQuery = useCustomers();
  const createCustomer = useCreateCustomer();
  const [draft] = useState(() => takeCustomerCreationDraft());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(input: CustomerInput, pendingDocuments: PendingDocument[]) {
    if (!agencyQuery.data) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const customer = await createCustomer.mutateAsync({ agencyId: agencyQuery.data.agencyId, input });

      if (pendingDocuments.length > 0) {
        const { failed } = await addPendingDocuments(
          agencyQuery.data.agencyId,
          { kind: 'customer', id: customer.id },
          pendingDocuments.map(({ localUri, localUriVerso, ...documentInput }) => ({ input: documentInput, localUri, localUriVerso }))
        );
        if (failed > 0) {
          Alert.alert(t('common.appName'), t('customer.form.uploadError'));
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
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('customer.form.newTitle')} showBack />
        <CustomerForm
          mode="create"
          draft={draft}
          allCustomers={customersQuery.data ?? []}
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
