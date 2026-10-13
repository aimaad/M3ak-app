import { View } from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { DocumentPhotoField } from '@/components/document-photo-field';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { CUSTOMER_DOCUMENTS_BUCKET } from './documents-api';
import { isLicenceDocument, type DocumentFormErrors, type DocumentFormValues } from './documents';
import { DOCUMENT_TYPES, type DocumentType } from './types';

type DocumentFormProps = {
  values: DocumentFormValues;
  onChange: (values: DocumentFormValues) => void;
  errors?: DocumentFormErrors;
  /** Photo choisie localement, pas encore envoyée. */
  localUri: string | null;
  onPickFile: (uri: string) => void;
  /** Fichier déjà enregistré (correction d'un document existant). */
  existingPath?: string | null;
  /** Empêche de changer le type (correction d'un document existant). */
  lockType?: boolean;
  /** Champs du document lus avec un doute par l'OCR, à vérifier. */
  uncertain?: ('reference' | 'dateDelivrance' | 'expiresAt' | 'categories' | 'issuingAuthority')[];
  /** Masque le choix du fichier (correction des informations seules). */
  hideFile?: boolean;
};

/** Formulaire d'un document : type, fichier, numéro, autorité, dates, catégories, notes. Aucun champ obligatoire. */
export function DocumentForm({
  values,
  onChange,
  errors = {},
  localUri,
  onPickFile,
  existingPath,
  lockType,
  uncertain = [],
  hideFile,
}: DocumentFormProps) {
  const { t } = useLanguage();

  function update<K extends keyof DocumentFormValues>(key: K, value: DocumentFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  const verify = (field: (typeof uncertain)[number]) => (uncertain.includes(field) ? t('customer.ocr.verifyField') : undefined);
  const errorText = (code: DocumentFormErrors[keyof DocumentFormErrors]) =>
    code ? t(`customer.documentForm.errors.${code}`) : undefined;

  return (
    <View className="gap-3">
      {lockType ? null : (
        <View className="gap-1.5">
          <ThemedText type="small" themeColor="textSecondary">
            {t('customer.documentForm.type')}
          </ThemedText>
          <ChipGroup<DocumentType>
            options={DOCUMENT_TYPES}
            selected={values.type}
            getLabel={(type) => t(`customer.documentTypes.${type}`)}
            onSelect={(type) => update('type', type)}
          />
        </View>
      )}

      {values.type === 'autre' ? (
        <TextField
          label={t('customer.documentForm.customLabel')}
          value={values.customLabel}
          onChangeText={(v) => update('customLabel', v)}
          placeholder={t('customer.documentForm.customLabelPlaceholder')}
          error={errorText(errors.customLabel)}
        />
      ) : null}

      {hideFile ? null : (
        <DocumentPhotoField
          label={t('customer.documentForm.file')}
          bucket={CUSTOMER_DOCUMENTS_BUCKET}
          localUri={localUri}
          existingPath={existingPath ?? undefined}
          onPick={onPickFile}
        />
      )}

      <TextField
        label={t('customer.documentForm.reference')}
        value={values.reference}
        onChangeText={(v) => update('reference', v)}
        autoCapitalize="characters"
        placeholder={t('customer.documentForm.optional')}
        warning={verify('reference')}
      />
      <TextField
        label={t('customer.documentForm.issuingAuthority')}
        value={values.issuingAuthority}
        onChangeText={(v) => update('issuingAuthority', v)}
        placeholder={t('customer.documentForm.optional')}
        warning={verify('issuingAuthority')}
      />
      {isLicenceDocument(values.type) ? (
        <TextField
          label={t('customer.documentForm.categories')}
          value={values.categories}
          onChangeText={(v) => update('categories', v)}
          autoCapitalize="characters"
          placeholder={t('customer.documentForm.categoriesPlaceholder')}
          warning={verify('categories')}
        />
      ) : null}
      <View className="flex-row gap-2">
        <TextField
          label={t('customer.documentForm.dateDelivrance')}
          value={values.dateDelivrance}
          onChangeText={(v) => update('dateDelivrance', v)}
          placeholder={t('customer.fields.datePlaceholder')}
          className="flex-1"
          error={errorText(errors.dateDelivrance)}
          warning={verify('dateDelivrance')}
        />
        <TextField
          label={t('customer.documentForm.expiresAt')}
          value={values.expiresAt}
          onChangeText={(v) => update('expiresAt', v)}
          placeholder={t('customer.fields.datePlaceholder')}
          className="flex-1"
          error={errorText(errors.expiresAt)}
          warning={verify('expiresAt')}
        />
      </View>
      <TextField
        label={t('customer.documentForm.notes')}
        value={values.notes}
        onChangeText={(v) => update('notes', v)}
        multiline
        numberOfLines={2}
        className="min-h-16"
        placeholder={t('customer.documentForm.optional')}
      />
    </View>
  );
}
