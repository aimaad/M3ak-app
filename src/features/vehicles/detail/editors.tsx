import { useState } from 'react';
import { View } from 'react-native';

import { Palette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { HText } from '@/features/dashboard/home-ui';
import { mergeDocuments } from '@/features/storage/documents';
import { useLanguage } from '@/i18n/use-language';

import { uploadVehicleDocument, VEHICLE_DOCUMENTS_BUCKET } from '../api';
import { useUpdateVehicleDocuments, useUpdateVehicleSpecs } from '../hooks';
import { FUEL_TYPES, VEHICLE_CATEGORIES, VEHICLE_TRANSMISSIONS, type Vehicle, type VehicleDocument } from '../types';
import { documentChanges, documentsDraft, EDITABLE_DOCUMENT_TYPES, hasSpecsChanges, specsDraft, specsPatch, validateSpecs, type DocumentsDraft, type EditableDocumentType, type SpecsDraft } from './edit-draft';
import { Chips, Field, FieldGroup, FormActions, FormCard, PaperPhotoField } from './form-ui';

/** Fiche technique modifiable SUR PLACE (à l'endroit de la grille) : mêmes règles que le formulaire complet, enregistre seulement ces champs. */
export function SpecsEditor({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { t } = useLanguage();
  const update = useUpdateVehicleSpecs();
  const [draft, setDraft] = useState<SpecsDraft>(() => specsDraft(vehicle));
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = validateSpecs(draft);
  const set = <K extends keyof SpecsDraft>(key: K, value: SpecsDraft[K]) => setDraft((previous) => ({ ...previous, [key]: value }));
  const message = (field: keyof SpecsDraft) => (touched && errors[field] ? t(`vehicle.form.errors.${errors[field]}`) : undefined);
  const digits = (value: string) => value.replace(/\D/g, '');

  function save() {
    setTouched(true);
    setError(null);
    if (Object.keys(errors).length > 0) return;
    if (!hasSpecsChanges(vehicle, draft)) return onClose();
    update.mutate({ id: vehicle.id, patch: specsPatch(vehicle, draft) }, { onSuccess: onClose, onError: () => setError(t('vehicleDetail.editor.saveError')) });
  }

  const label = (key: string) => t(`vehicle.fields.${key}`);
  return (
    <FormCard title={t('vehicleDetail.specs.title')}>
      <FieldGroup label={label('categorie')}>
        <Chips options={VEHICLE_CATEGORIES} selected={draft.categorie} getLabel={(value) => t(`vehicle.category.${value}`)} onSelect={(value) => set('categorie', value)} />
      </FieldGroup>
      <FieldGroup label={label('transmission')}>
        <Chips options={VEHICLE_TRANSMISSIONS} selected={draft.transmission} getLabel={(value) => t(`vehicle.transmission.${value}`)} onSelect={(value) => set('transmission', value)} />
      </FieldGroup>
      <FieldGroup label={label('carburant')}>
        <Chips options={FUEL_TYPES} selected={draft.carburant} getLabel={(value) => t(`vehicle.fuel.${value}`)} onSelect={(value) => set('carburant', value)} />
      </FieldGroup>
      <Field large label={label('kilometrage')} value={draft.kilometrage} onChangeText={(value) => set('kilometrage', digits(value))} keyboardType="number-pad" unit={t('flotte.km')} error={message('kilometrage')} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label={label('annee')} value={draft.annee} onChangeText={(value) => set('annee', digits(value))} keyboardType="number-pad" maxLength={4} error={message('annee')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={label('nombrePlaces')} value={draft.nombrePlaces} onChangeText={(value) => set('nombrePlaces', digits(value))} keyboardType="number-pad" maxLength={1} error={message('nombrePlaces')} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label={label('couleur')} value={draft.couleur} onChangeText={(value) => set('couleur', value)} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={label('puissanceFiscale')} value={draft.puissanceFiscale} onChangeText={(value) => set('puissanceFiscale', digits(value))} keyboardType="number-pad" maxLength={2} error={message('puissanceFiscale')} />
        </View>
      </View>
      <FormActions onSave={save} onCancel={onClose} busy={update.isPending} error={error} />
    </FormCard>
  );
}

/** Documents modifiables SUR PLACE : photos de la carte grise (recto et verso), envoyées ensemble à l'enregistrement. */
export function DocumentsEditor({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { t } = useLanguage();
  const agency = useMyAgency();
  const updateDocuments = useUpdateVehicleDocuments();
  const [draft, setDraft] = useState<DocumentsDraft>(() => documentsDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const changes = documentChanges(draft);
    if (changes.length === 0) return onClose();
    if (!agency.data) return;
    setBusy(true);
    try {
      const incoming: VehicleDocument[] = [];
      for (const change of changes) incoming.push(await uploadVehicleDocument(agency.data.agencyId, vehicle.id, change.type, change.localUri, null));
      await updateDocuments.mutateAsync({ id: vehicle.id, documents: mergeDocuments(vehicle.documents, incoming) });
      onClose();
    } catch {
      setError(t('vehicleDetail.editor.uploadError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormCard title={t('vehicleDetail.documents.title')}>
      {EDITABLE_DOCUMENT_TYPES.map((type: EditableDocumentType) => (
        <PaperPhotoField
          key={type}
          label={t(`vehicle.documents.${type}`)}
          bucket={VEHICLE_DOCUMENTS_BUCKET}
          localUri={draft[type].localUri}
          existingPath={vehicle.documents.find((doc) => doc.type === type && doc.path)?.path}
          onPick={(uri) => setDraft((previous) => ({ ...previous, [type]: { localUri: uri } }))}
        />
      ))}
      <HText size={12} color={Palette.textSecondary}>
        {t('vehicleDetail.editor.insuranceElsewhere')}
      </HText>
      <FormActions onSave={() => void save()} onCancel={onClose} busy={busy} error={error} />
    </FormCard>
  );
}
