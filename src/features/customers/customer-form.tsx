import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChipGroup } from '@/components/chip-group';
import { CollapsibleSection } from '@/components/collapsible-section';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import {
  entriesAreValid,
  entriesFromPending,
  entriesToPending,
  newEntryKey,
  reconcilePermisNumber,
  type PendingEntry,
} from './creation';
import { DocumentForm } from './document-form';
import { documentLabel, EMPTY_DOCUMENT_FORM, validateDocumentForm } from './documents';
import { findPotentialDuplicates } from './duplicates';
import { EMPTY_CREATION_DRAFT, type CustomerCreationDraft } from './licence-ocr';
import { CUSTOMER_TYPES, PREFERRED_LANGUAGES } from './types';
import type { Customer, CustomerInput, CustomerType, PendingDocument, PreferredLanguage } from './types';
import { isFormValid, toCustomerInput, validateCustomerForm, type CustomerFormValues } from './validation';

type CustomerFormProps = {
  /** « create » : documents joints à la création (après scan ou à la main) ; « edit » : les documents se gèrent depuis la fiche. */
  mode: 'create' | 'edit';
  initialValues?: CustomerFormValues;
  /** Brouillon issu du scan du permis (création uniquement). */
  draft?: CustomerCreationDraft;
  existingCustomerId?: string;
  allCustomers?: Customer[];
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  submitError?: string | null;
  onSubmit: (input: CustomerInput, pendingDocuments: PendingDocument[]) => void;
};

export const EMPTY_CUSTOMER_VALUES: CustomerFormValues = {
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
};

export function CustomerForm({
  mode,
  initialValues,
  draft = EMPTY_CREATION_DRAFT,
  existingCustomerId,
  allCustomers = [],
  submitLabel,
  submittingLabel,
  isSubmitting,
  submitError,
  onSubmit,
}: CustomerFormProps) {
  const { t } = useLanguage();
  const [values, setValues] = useState<CustomerFormValues>(() => ({
    ...(initialValues ?? EMPTY_CUSTOMER_VALUES),
    ...draft.values,
  }));
  const [entries, setEntries] = useState<PendingEntry[]>(() => entriesFromPending(draft.pendingDocuments));
  const [touched, setTouched] = useState(false);

  const errors = validateCustomerForm(values);
  const showErrors = touched;
  const isEntreprise = values.typeClient === 'entreprise';
  const uncertain = new Set<string>(draft.uncertainFields);

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

  const verify = (key: keyof CustomerFormValues) => (uncertain.has(key) ? t('customer.ocr.verifyField') : undefined);

  function updateEntry(key: string, patch: Partial<PendingEntry>) {
    setEntries((prev) => prev.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)));
  }

  function addEntry() {
    const hasPermis = entries.some((entry) => entry.values.type === 'permis');
    setEntries((prev) => [
      ...prev,
      { key: newEntryKey(), localUri: null, values: { ...EMPTY_DOCUMENT_FORM, type: hasPermis ? 'cin' : 'permis' } },
    ]);
  }

  function handleSubmit() {
    setTouched(true);
    if (!isFormValid(errors) || !entriesAreValid(entries)) return;
    const reconciled = reconcilePermisNumber(toCustomerInput(values), entriesToPending(entries));
    onSubmit(reconciled.input, reconciled.documents);
  }

  const entryBadge = entries.length > 0 ? String(entries.length) : undefined;

  return (
    <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
      {draft.fromOcr ? (
        <View className="gap-1 rounded-2xl px-4 py-3" style={{ backgroundColor: M3akPalette.mauveLight }}>
          <ThemedText type="smallBold" style={{ color: M3akPalette.mauveDeep }}>
            {t('customer.ocr.bannerTitle')}
          </ThemedText>
          <ThemedText type="small" style={{ color: M3akPalette.mauveDeep }}>
            {t('customer.ocr.bannerBody')}
          </ThemedText>
        </View>
      ) : null}

      <CollapsibleSection title={t('customer.sections.general')} defaultOpen>
        <TextField
          label={t('customer.fields.nomComplet')}
          value={values.nomComplet}
          onChangeText={(v) => update('nomComplet', v)}
          error={showErrors && errors.nomComplet ? t(`customer.form.errors.${errors.nomComplet}`) : undefined}
          warning={verify('nomComplet')}
        />
        <TextField
          label={t('customer.fields.prenom')}
          value={values.prenom}
          onChangeText={(v) => update('prenom', v)}
          placeholder={t('customer.fields.optionalPlaceholder')}
          warning={verify('prenom')}
        />
        <TextField
          label={t('customer.fields.nom')}
          value={values.nom}
          onChangeText={(v) => update('nom', v)}
          placeholder={t('customer.fields.optionalPlaceholder')}
          warning={verify('nom')}
        />
        <TextField
          label={t('customer.fields.telephone')}
          value={values.telephone}
          onChangeText={(v) => update('telephone', v)}
          keyboardType="phone-pad"
          placeholder="+212 6XX XX XX XX"
          error={showErrors && errors.telephone ? t(`customer.form.errors.${errors.telephone}`) : undefined}
        />
        {duplicates.length > 0 ? (
          <View className="rounded-2xl bg-[#FEF3C7] px-4 py-3">
            <ThemedText type="small" style={{ color: '#B45309' }}>
              {t('customer.duplicateWarning', { count: duplicates.length, name: duplicates[0].nomComplet })}
            </ThemedText>
          </View>
        ) : null}
      </CollapsibleSection>

      {mode === 'create' ? (
        <CollapsibleSection
          title={t('customer.sections.documents')}
          badge={entryBadge}
          defaultOpen={draft.fromOcr || entries.length > 0}
        >
          <TextField
            label={t('customer.fields.permis')}
            value={values.numeroPermis}
            onChangeText={(v) => update('numeroPermis', v)}
            autoCapitalize="characters"
            warning={verify('numeroPermis')}
          />
          <TextField
            label={t('customer.fields.cin')}
            value={values.cinOuPasseport}
            onChangeText={(v) => update('cinOuPasseport', v)}
            autoCapitalize="characters"
          />

          {entries.map((entry) => {
            const entryErrors = validateDocumentForm(entry.values);
            return (
              <Card key={entry.key} className="gap-3">
                <View className="flex-row items-center justify-between">
                  <ThemedText type="smallBold">
                    {documentLabel(
                      { type: entry.values.type, customLabel: entry.values.customLabel },
                      t
                    )}
                  </ThemedText>
                  <Button
                    label={t('customer.documentsManager.removePending')}
                    variant="ghost"
                    size="sm"
                    onPress={() => setEntries((prev) => prev.filter((e) => e.key !== entry.key))}
                  />
                </View>
                <DocumentForm
                  values={entry.values}
                  onChange={(next) => updateEntry(entry.key, { values: next })}
                  errors={showErrors ? entryErrors : {}}
                  localUri={entry.localUri}
                  onPickFile={(uri) => updateEntry(entry.key, { localUri: uri })}
                  uncertain={entry.values.type === 'permis' ? draft.uncertainDocumentFields : []}
                />
              </Card>
            );
          })}

          <Button
            label={t('customer.documentsManager.addButton')}
            variant="secondary"
            icon="add-circle-outline"
            onPress={addEntry}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t('customer.documentsManager.optionalHint')}
          </ThemedText>
        </CollapsibleSection>
      ) : (
        <CollapsibleSection title={t('customer.sections.identifiers')}>
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
        </CollapsibleSection>
      )}

      <CollapsibleSection title={t('customer.sections.coordonnees')}>
        <TextField
          label={t('customer.fields.telephoneSecondaire')}
          value={values.telephoneSecondaire}
          onChangeText={(v) => update('telephoneSecondaire', v)}
          keyboardType="phone-pad"
          placeholder={t('customer.fields.optionalPlaceholder')}
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
          label={t('customer.fields.dateNaissance')}
          value={values.dateNaissance}
          onChangeText={(v) => update('dateNaissance', v)}
          placeholder={t('customer.fields.datePlaceholder')}
          error={showErrors && errors.dateNaissance ? t(`customer.form.errors.${errors.dateNaissance}`) : undefined}
          warning={verify('dateNaissance')}
        />
        <TextField label={t('customer.fields.adresse')} value={values.adresse} onChangeText={(v) => update('adresse', v)} />
        <TextField label={t('customer.fields.ville')} value={values.ville} onChangeText={(v) => update('ville', v)} />
        <TextField label={t('customer.fields.pays')} value={values.pays} onChangeText={(v) => update('pays', v)} />
        <View className="gap-1.5">
          <ThemedText type="small" themeColor="textSecondary">
            {t('customer.fields.languePreferee')}
          </ThemedText>
          <ChipGroup<PreferredLanguage>
            options={PREFERRED_LANGUAGES}
            selected={values.languePreferee}
            getLabel={(l) => t(`customer.language.${l}`)}
            onSelect={(l) => update('languePreferee', l)}
          />
        </View>
      </CollapsibleSection>

      <CollapsibleSection title={t('customer.sections.type')} badge={isEntreprise ? t('customer.type.entreprise') : undefined}>
        <ChipGroup<CustomerType>
          options={CUSTOMER_TYPES}
          selected={values.typeClient}
          getLabel={(ct) => t(`customer.type.${ct}`)}
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
      </CollapsibleSection>

      {mode === 'create' ? (
        <View className="rounded-2xl border border-dashed border-[#EAE5F2] bg-white p-4">
          <ThemedText type="small" themeColor="textSecondary">
            {t('customer.afterCreateHint')}
          </ThemedText>
        </View>
      ) : null}

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
