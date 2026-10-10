import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { uploadCustomerDocument } from '@/features/customers/api';
import { CustomerForm } from '@/features/customers/customer-form';
import { mergeDocuments } from '@/features/storage/documents';
import { useCustomer, useCustomers, useUpdateCustomer, useUpdateCustomerDocuments } from '@/features/customers/hooks';
import type { CustomerInput, PendingDocument } from '@/features/customers/types';
import type { CustomerFormValues } from '@/features/customers/validation';
import { useLanguage } from '@/i18n/use-language';

export default function ModifierClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: customer, isLoading, isError } = useCustomer(id);
  const customersQuery = useCustomers();
  const updateCustomer = useUpdateCustomer();
  const updateDocuments = useUpdateCustomerDocuments();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(input: CustomerInput, pendingDocuments: PendingDocument[]) {
    if (!customer) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await updateCustomer.mutateAsync({ id: customer.id, input });

      if (pendingDocuments.length > 0) {
        try {
          const uploaded = await Promise.all(
            pendingDocuments.map((doc) =>
              uploadCustomerDocument(customer.agencyId, customer.id, doc.type, doc.localUri, {
                reference: doc.reference,
                dateDelivrance: doc.dateDelivrance,
                expiresAt: doc.expiresAt,
              })
            )
          );
          await updateDocuments.mutateAsync({
            id: customer.id,
            documents: mergeDocuments(customer.documents, uploaded),
          });
        } catch {
          Alert.alert(t('common.appName'), t('customer.form.uploadError'));
        }
      }

      router.back();
    } catch {
      setSubmitError(t('customer.form.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const initialValues: CustomerFormValues | undefined = customer
    ? {
        nomComplet: customer.nomComplet,
        prenom: customer.prenom ?? '',
        nom: customer.nom ?? '',
        cinOuPasseport: customer.cinOuPasseport ?? '',
        numeroPermis: customer.numeroPermis ?? '',
        telephone: customer.telephone ?? '',
        telephoneSecondaire: customer.telephoneSecondaire ?? '',
        email: customer.email ?? '',
        adresse: customer.adresse ?? '',
        ville: customer.ville ?? '',
        pays: customer.pays,
        dateNaissance: customer.dateNaissance ?? '',
        languePreferee: customer.languePreferee,
        typeClient: customer.typeClient,
        raisonSociale: customer.raisonSociale ?? '',
        ice: customer.ice ?? '',
        notes: customer.notes ?? '',
      }
    : undefined;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('customer.form.editTitle')} showBack />
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
        ) : !customer || !initialValues ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary">
              {t('customer.notFound')}
            </ThemedText>
          </View>
        ) : (
          <CustomerForm
            key={customer.id}
            initialValues={initialValues}
            existingDocuments={customer.documents}
            existingCustomerId={customer.id}
            allCustomers={customersQuery.data ?? []}
            submitLabel={t('customer.form.save')}
            submittingLabel={t('customer.form.saving')}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onSubmit={handleSubmit}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
