import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChipGroup } from '@/components/chip-group';
import { CollapsibleSection } from '@/components/collapsible-section';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ZoomableImage } from '@/components/zoomable-image';
import { M3akPalette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import {
  entriesAreValid,
  entriesFromPending,
  entriesToPending,
  isEmptyEntry,
  licenceGaps,
  newEntryKey,
  reconcilePermisNumber,
  type PendingEntry,
} from './creation';
import { DocumentForm } from './document-form';
import { documentLabel, EMPTY_DOCUMENT_FORM, validateDocumentForm } from './documents';
import { DuplicateCustomerCard } from './duplicate-customer-card';
import { findDuplicateMatches } from './duplicates';
import { EMPTY_CREATION_DRAFT, type CustomerCreationDraft } from './licence-ocr';
import { CUSTOMER_TYPES, PREFERRED_LANGUAGES } from './types';
import type { Customer, CustomerInput, CustomerType, PendingDocument, PreferredLanguage } from './types';
import { fullNameOf, isFormValid, toCustomerInput, validateCustomerForm, type CustomerFormValues } from './validation';

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
  const [entries, setEntries] = useState<PendingEntry[]>(() => {
    const initial = entriesFromPending(draft.pendingDocuments);
    // Création : la ligne « permis » est toujours là, à remplir (obligatoire pour un particulier).
    return mode === 'create' && !initial.some((entry) => entry.values.type === 'permis')
      ? [{ key: newEntryKey(), localUri: null, values: { ...EMPTY_DOCUMENT_FORM, type: 'permis' as const } }, ...initial]
      : initial;
  });
  const [touched, setTouched] = useState(false);

  const scannedPhotos = entries.flatMap((entry) => [
    ...(entry.localUri ? [{ face: 'recto' as const, uri: entry.localUri }] : []),
    ...(entry.localUriVerso ? [{ face: 'verso' as const, uri: entry.localUriVerso }] : []),
  ]).slice(0, 2);

  const errors = validateCustomerForm(values);
  const showErrors = touched;
  const isEntreprise = values.typeClient === 'entreprise';
  const uncertain = new Set<string>(draft.uncertainFields);

  const permisReference = entries.find((entry) => entry.values.type === 'permis')?.values.reference ?? '';
  const fullName = fullNameOf(values);
  const duplicates = useMemo(
    () =>
      findDuplicateMatches(
        allCustomers,
        {
          telephone: values.telephone,
          cinOuPasseport: values.cinOuPasseport,
          numeroPermis: values.numeroPermis || permisReference,
          nomComplet: fullName,
          dateNaissance: values.dateNaissance,
        },
        existingCustomerId
      ),
    [allCustomers, values.telephone, values.cinOuPasseport, values.numeroPermis, permisReference, fullName, values.dateNaissance, existingCustomerId]
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

  const licenceRequired = mode === 'create' && !isEntreprise;
  const gaps = licenceRequired ? licenceGaps(entries, values.numeroPermis) : [];

  function handleSubmit() {
    setTouched(true);
    if (!isFormValid(errors) || !entriesAreValid(entries) || gaps.length > 0) return;
    const kept = licenceRequired ? entries : entries.filter((entry) => !isEmptyEntry(entry));
    const reconciled = reconcilePermisNumber(toCustomerInput(values), entriesToPending(kept));
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
          {draft.fromCache ? (
            <ThemedText type="small" style={{ color: M3akPalette.mauveDeep }}>
              {t('ocr.fromCache')}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      {draft.fromOcr && scannedPhotos.length > 0 ? (
        <View className="gap-1">
          <View className="flex-row gap-2" style={{ height: 150 }}>
            {scannedPhotos.map((photo) => (
              <ZoomableImage key={photo.face} uri={photo.uri} label={t(`vehicle.quickCreate.face.${photo.face}`)} style={{ borderRadius: 16 }} />
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {t('common.zoomHint')}
          </ThemedText>
        </View>
      ) : null}

      {(draft.warnings ?? []).map((code) => (
        <View key={code} className="rounded-2xl px-4 py-3" style={{ backgroundColor: code === 'licence_expiring' ? '#EDE9FE' : M3akPalette.warningLight }}>
          <ThemedText type="small" style={{ color: code === 'licence_expiring' ? '#5B21B6' : M3akPalette.warning }}>
            {t(`customer.ocr.checks.${code}`)}
          </ThemedText>
        </View>
      ))}

      <DuplicateCustomerCard matches={duplicates} />

      <CollapsibleSection title={t('customer.sections.general')} defaultOpen>
        <TextField
          label={t('customer.fields.prenom')}
          value={values.prenom}
          onChangeText={(v) => update('prenom', v)}
          error={showErrors && errors.prenom ? t(`customer.form.errors.${errors.prenom}`) : undefined}
          warning={verify('prenom')}
        />
        <TextField
          label={t('customer.fields.nom')}
          value={values.nom}
          onChangeText={(v) => update('nom', v)}
          error={showErrors && errors.nom ? t(`customer.form.errors.${errors.nom}`) : undefined}
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
      </CollapsibleSection>

      {mode === 'create' ? (
        <CollapsibleSection
          title={t('customer.sections.documents')}
          badge={entryBadge}
          defaultOpen
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
                  localUriVerso={entry.localUriVerso ?? null}
                  onPickFileVerso={(uri) => updateEntry(entry.key, { localUriVerso: uri })}
                  uncertain={entry.values.type === 'permis' ? draft.uncertainDocumentFields : []}
                />
              </Card>
            );
          })}

          {showErrors && gaps.length > 0 ? (
            <View className="gap-1 rounded-2xl px-4 py-3" style={{ backgroundColor: M3akPalette.dangerLight }}>
              {gaps.map((gap) => (
                <ThemedText key={gap} type="small" style={{ color: M3akPalette.danger }}>
                  {t(`customer.documentsManager.licenceRequired.${gap}`)}
                </ThemedText>
              ))}
            </View>
          ) : null}

          <Button
            label={t('customer.documentsManager.addButton')}
            variant="secondary"
            icon="add-circle-outline"
            onPress={addEntry}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t(licenceRequired ? 'customer.documentsManager.licenceHint' : 'customer.documentsManager.optionalHint')}
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
