import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomerForm } from '@/features/customers/customer-form';
import { useCustomer, useCustomers, useUpdateCustomer } from '@/features/customers/hooks';
import type { CustomerInput } from '@/features/customers/types';
import { splitFullName, type CustomerFormValues } from '@/features/customers/validation';
import { useLanguage } from '@/i18n/use-language';

export default function ModifierClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: customer, isLoading, isError } = useCustomer(id);
  const customersQuery = useCustomers();
  const updateCustomer = useUpdateCustomer();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(input: CustomerInput) {
    if (!customer) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await updateCustomer.mutateAsync({ id: customer.id, input });
      router.back();
    } catch {
      setSubmitError(t('customer.form.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const initialValues: CustomerFormValues | undefined = customer
    ? {
        // Fiche créée avant la séparation prénom / nom : on propose un découpage, à corriger si besoin.
        ...(customer.prenom || customer.nom ? { prenom: customer.prenom ?? '', nom: customer.nom ?? '' } : splitFullName(customer.nomComplet)),
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
            mode="edit"
            initialValues={initialValues}
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
