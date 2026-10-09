import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView } from 'react-native';

import { DocumentPhotoField } from '@/components/document-photo-field';
import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/text-field';
import { findDocument } from '@/features/storage/documents';
import { useLanguage } from '@/i18n/use-language';

import { DOCUMENTS_BUCKET } from './api';
import type { CustomerDocument, CustomerInput, PendingDocument } from './types';
import { isFormValid, toCustomerInput, validateCustomerForm, type CustomerFormValues } from './validation';

type CustomerFormProps = {
  initialValues?: CustomerFormValues;
  existingDocuments?: CustomerDocument[];
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  submitError?: string | null;
  onSubmit: (input: CustomerInput, pendingDocuments: PendingDocument[]) => void;
};

const EMPTY_VALUES: CustomerFormValues = {
  nomComplet: '',
  cinOuPasseport: '',
  numeroPermis: '',
  telephone: '',
  email: '',
};

export function CustomerForm({
  initialValues,
  existingDocuments = [],
  submitLabel,
  submittingLabel,
  isSubmitting,
  submitError,
  onSubmit,
}: CustomerFormProps) {
  const { t } = useLanguage();
  const [values, setValues] = useState<CustomerFormValues>(initialValues ?? EMPTY_VALUES);
  const [touched, setTouched] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);

  const errors = validateCustomerForm(values);
  const showErrors = touched;

  function update<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function pickDocument(type: PendingDocument['type'], localUri: string) {
    setPendingDocuments((prev) => [...prev.filter((doc) => doc.type !== type), { type, localUri }]);
  }

  function handleSubmit() {
    setTouched(true);
    if (!isFormValid(errors)) return;
    onSubmit(toCustomerInput(values), pendingDocuments);
  }

  return (
    <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
      <TextField
        label={t('customer.fields.nomComplet')}
        value={values.nomComplet}
        onChangeText={(v) => update('nomComplet', v)}
        error={showErrors && errors.nomComplet ? t(`customer.form.errors.${errors.nomComplet}`) : undefined}
      />
      <TextField
        label={t('customer.fields.telephone')}
        value={values.telephone}
        onChangeText={(v) => update('telephone', v)}
        keyboardType="phone-pad"
        placeholder="+212 6XX XX XX XX"
        error={showErrors && errors.telephone ? t(`customer.form.errors.${errors.telephone}`) : undefined}
      />
      <TextField
        label={t('customer.fields.email')}
        value={values.email}
        onChangeText={(v) => update('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
        error={showErrors && errors.email ? t(`customer.form.errors.${errors.email}`) : undefined}
      />
      <TextField
        label={t('customer.fields.cin')}
        value={values.cinOuPasseport}
        onChangeText={(v) => update('cinOuPasseport', v)}
        autoCapitalize="characters"
      />
      <TextField
        label={t('customer.fields.permis')}
        value={values.numeroPermis}
        onChangeText={(v) => update('numeroPermis', v)}
        autoCapitalize="characters"
      />

      <DocumentPhotoField
        label={t('customer.documents.cin')}
        bucket={DOCUMENTS_BUCKET}
        localUri={pendingDocuments.find((d) => d.type === 'cin')?.localUri ?? null}
        existingPath={findDocument(existingDocuments, 'cin')?.path}
        onPick={(uri) => pickDocument('cin', uri)}
      />
      <DocumentPhotoField
        label={t('customer.documents.permis')}
        bucket={DOCUMENTS_BUCKET}
        localUri={pendingDocuments.find((d) => d.type === 'permis')?.localUri ?? null}
        existingPath={findDocument(existingDocuments, 'permis')?.path}
        onPick={(uri) => pickDocument('permis', uri)}
      />

      {submitError ? (
        <ThemedText type="small" style={{ color: '#dc2626' }}>
          {submitError}
        </ThemedText>
      ) : null}

      <Pressable
        onPress={handleSubmit}
        disabled={isSubmitting}
        className={`mt-2 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
          isSubmitting ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
        }`}
      >
        {isSubmitting ? <ActivityIndicator color="#ffffff" /> : null}
        <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
          {isSubmitting ? submittingLabel : submitLabel}
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}
