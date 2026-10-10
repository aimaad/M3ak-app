import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { DocumentPhotoField } from '@/components/document-photo-field';
import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/text-field';
import { findDocument } from '@/features/storage/documents';
import { useLanguage } from '@/i18n/use-language';

import { DOCUMENTS_BUCKET } from './api';
import { findPotentialDuplicates } from './duplicates';
import { CUSTOMER_TYPES, DOCUMENT_TYPES, PREFERRED_LANGUAGES } from './types';
import { isFormValid, toCustomerInput, validateCustomerForm, type CustomerFormValues } from './validation';
import type { Customer, CustomerDocument, CustomerInput, CustomerType, PendingDocument, PreferredLanguage } from './types';

type CustomerFormProps = {
  initialValues?: CustomerFormValues;
  existingDocuments?: CustomerDocument[];
  existingCustomerId?: string;
  allCustomers?: Customer[];
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  submitError?: string | null;
  onSubmit: (input: CustomerInput, pendingDocuments: PendingDocument[]) => void;
};

const EMPTY_VALUES: CustomerFormValues = {
  nomComplet: '',
  prenom: '',
  nom: '',
  cinOuPasseport: '',
  numeroPermis: '',
  telephone: '',
  telephoneSecondaire: '',
  email: '',
  adresse: '',
  ville: '',
  pays: 'Maroc',
  dateNaissance: '',
  languePreferee: null,
  typeClient: 'particulier',
  raisonSociale: '',
  ice: '',
  notes: '',
};

function ChipGroup<T extends string>({
  options,
  selected,
  getLabel,
  onSelect,
}: {
  options: T[];
  selected: T | null;
  getLabel: (value: T) => string;
  onSelect: (value: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected === option;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            className={`rounded-full border px-4 py-2 ${
              isSelected ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'
            }`}
          >
            <ThemedText type="small" style={{ color: isSelected ? '#ffffff' : '#211A2E' }}>
              {getLabel(option)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" className="mt-2">
      {children}
    </ThemedText>
  );
}

export function CustomerForm({
  initialValues,
  existingDocuments = [],
  existingCustomerId,
  allCustomers = [],
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
  const [documentMeta, setDocumentMeta] = useState<Record<string, { reference: string; expiresAt: string }>>({});

  const errors = validateCustomerForm(values);
  const showErrors = touched;
  const isEntreprise = values.typeClient === 'entreprise';

  const duplicates = useMemo(
    () =>
      findPotentialDuplicates(
        allCustomers,
        { telephone: values.telephone, cinOuPasseport: values.cinOuPasseport },
        existingCustomerId
      ),
    [allCustomers, values.telephone, values.cinOuPasseport, existingCustomerId]
  );

  function update<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function pickDocument(type: PendingDocument['type'], localUri: string) {
    const meta = documentMeta[type];
    setPendingDocuments((prev) => [
      ...prev.filter((doc) => doc.type !== type),
      {
        type,
        localUri,
        reference: meta?.reference?.trim() || null,
        dateDelivrance: null,
        expiresAt: meta?.expiresAt?.trim() || null,
      },
    ]);
  }

  function handleSubmit() {
    setTouched(true);
    if (!isFormValid(errors)) return;
    onSubmit(toCustomerInput(values), pendingDocuments);
  }

  return (
    <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
      <SectionTitle>{t('customer.sections.general')}</SectionTitle>
      <TextField
        label={t('customer.fields.nomComplet')}
        value={values.nomComplet}
        onChangeText={(v) => update('nomComplet', v)}
        error={showErrors && errors.nomComplet ? t(`customer.form.errors.${errors.nomComplet}`) : undefined}
      />
      <TextField
        label={t('customer.fields.prenom')}
        value={values.prenom}
        onChangeText={(v) => update('prenom', v)}
        placeholder={t('customer.fields.optionalPlaceholder')}
      />
      <TextField
        label={t('customer.fields.nom')}
        value={values.nom}
        onChangeText={(v) => update('nom', v)}
        placeholder={t('customer.fields.optionalPlaceholder')}
      />
      <TextField
        label={t('customer.fields.dateNaissance')}
        value={values.dateNaissance}
        onChangeText={(v) => update('dateNaissance', v)}
        placeholder={t('customer.fields.datePlaceholder')}
        error={showErrors && errors.dateNaissance ? t(`customer.form.errors.${errors.dateNaissance}`) : undefined}
      />

      <SectionTitle>{t('customer.sections.coordonnees')}</SectionTitle>
      <TextField
        label={t('customer.fields.telephone')}
        value={values.telephone}
        onChangeText={(v) => update('telephone', v)}
        keyboardType="phone-pad"
        placeholder="+212 6XX XX XX XX"
        error={showErrors && errors.telephone ? t(`customer.form.errors.${errors.telephone}`) : undefined}
      />
      <TextField
        label={t('customer.fields.telephoneSecondaire')}
        value={values.telephoneSecondaire}
        onChangeText={(v) => update('telephoneSecondaire', v)}
        keyboardType="phone-pad"
        placeholder={t('customer.fields.optionalPlaceholder')}
      />
      {duplicates.length > 0 ? (
        <View className="rounded-2xl bg-[#FEF3C7] px-4 py-3">
          <ThemedText type="small" style={{ color: '#B45309' }}>
            {t('customer.duplicateWarning', { count: duplicates.length, name: duplicates[0].nomComplet })}
          </ThemedText>
        </View>
      ) : null}
      <TextField
        label={t('customer.fields.email')}
        value={values.email}
        onChangeText={(v) => update('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
        error={showErrors && errors.email ? t(`customer.form.errors.${errors.email}`) : undefined}
      />
      <TextField
        label={t('customer.fields.adresse')}
        value={values.adresse}
        onChangeText={(v) => update('adresse', v)}
      />
      <TextField label={t('customer.fields.ville')} value={values.ville} onChangeText={(v) => update('ville', v)} />
      <TextField label={t('customer.fields.pays')} value={values.pays} onChangeText={(v) => update('pays', v)} />
      <View className="gap-1.5">
        <ThemedText type="small" themeColor="textSecondary">
          {t('customer.fields.languePreferee')}
        </ThemedText>
        <ChipGroup
          options={PREFERRED_LANGUAGES}
          selected={values.languePreferee}
          getLabel={(l: PreferredLanguage) => t(`customer.language.${l}`)}
          onSelect={(l) => update('languePreferee', l)}
        />
      </View>

      <SectionTitle>{t('customer.sections.type')}</SectionTitle>
      <ChipGroup
        options={CUSTOMER_TYPES}
        selected={values.typeClient}
        getLabel={(ct: CustomerType) => t(`customer.type.${ct}`)}
        onSelect={(ct) => update('typeClient', ct)}
      />
      {isEntreprise ? (
        <>
          <TextField
            label={t('customer.fields.raisonSociale')}
            value={values.raisonSociale}
            onChangeText={(v) => update('raisonSociale', v)}
            error={showErrors && errors.raisonSociale ? t(`customer.form.errors.${errors.raisonSociale}`) : undefined}
          />
          <TextField label={t('customer.fields.ice')} value={values.ice} onChangeText={(v) => update('ice', v)} />
        </>
      ) : null}
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

      <SectionTitle>{t('customer.sections.documents')}</SectionTitle>
      {DOCUMENT_TYPES.map((type) => {
        const existing = findDocument(existingDocuments, type);
        return (
          <View key={type} className="gap-2">
            <DocumentPhotoField
              label={t(`customer.documents.${type}`)}
              bucket={DOCUMENTS_BUCKET}
              localUri={pendingDocuments.find((d) => d.type === type)?.localUri ?? null}
              existingPath={existing?.path}
              onPick={(uri) => pickDocument(type, uri)}
            />
            <TextField
              placeholder={t('customer.documentReferencePlaceholder')}
              value={documentMeta[type]?.reference ?? ''}
              onChangeText={(v) =>
                setDocumentMeta((prev) => ({ ...prev, [type]: { ...prev[type], reference: v, expiresAt: prev[type]?.expiresAt ?? '' } }))
              }
            />
            <TextField
              placeholder={t('customer.documentExpiryPlaceholder')}
              value={documentMeta[type]?.expiresAt ?? ''}
              onChangeText={(v) =>
                setDocumentMeta((prev) => ({ ...prev, [type]: { ...prev[type], expiresAt: v, reference: prev[type]?.reference ?? '' } }))
              }
            />
          </View>
        );
      })}

      <SectionTitle>{t('customer.sections.conducteurs')}</SectionTitle>
      <View className="rounded-2xl border border-dashed border-[#EAE5F2] bg-white p-4">
        <ThemedText type="small" themeColor="textSecondary">
          {t('customer.driversAfterCreateHint')}
        </ThemedText>
      </View>

      <SectionTitle>{t('customer.sections.notes')}</SectionTitle>
      <TextField
        label={t('customer.fields.notes')}
        value={values.notes}
        onChangeText={(v) => update('notes', v)}
        multiline
        numberOfLines={3}
        className="min-h-20"
      />

      {submitError ? (
        <ThemedText type="small" style={{ color: '#DC2626' }}>
          {submitError}
        </ThemedText>
      ) : null}

      <Button
        label={isSubmitting ? submittingLabel : submitLabel}
        onPress={handleSubmit}
        disabled={isSubmitting}
        loading={isSubmitting}
        style={{ marginTop: 8 }}
      />
    </ScrollView>
  );
}
