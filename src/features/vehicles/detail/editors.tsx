import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { DocumentPhotoField } from '@/components/document-photo-field';
import { TextField } from '@/components/text-field';
import { Brand, Palette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { HText } from '@/features/dashboard/home-ui';
import { mergeDocuments } from '@/features/storage/documents';
import { useLanguage } from '@/i18n/use-language';

import { uploadVehicleDocument, VEHICLE_DOCUMENTS_BUCKET } from '../api';
import { useUpdateVehicleDocuments, useUpdateVehicleSpecs } from '../hooks';
import { FUEL_TYPES, VEHICLE_CATEGORIES, VEHICLE_TRANSMISSIONS, type Vehicle, type VehicleDocument } from '../types';
import { documentChanges, documentsDraft, EDITABLE_DOCUMENT_TYPES, hasSpecsChanges, specsDraft, specsPatch, validateSpecs, type DocumentsDraft, type EditableDocumentType, type SpecsDraft } from './edit-draft';

const CARD = { backgroundColor: Brand.white, borderWidth: 1, borderColor: Palette.border, borderRadius: 24, padding: 16, gap: 14 } as const;

function Buttons({ onSave, onCancel, busy, error }: { onSave: () => void; onCancel: () => void; busy: boolean; error: string | null }) {
  const { t } = useLanguage();
  return (
    <View style={{ gap: 10 }}>
      {error ? (
        <HText size={12} color={Palette.error} accessibilityRole="alert">
          {error}
        </HText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={onCancel} disabled={busy} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.editor.cancel')} style={{ flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
          <HText weight="semibold" size={14}>
            {t('vehicleDetail.editor.cancel')}
          </HText>
        </Pressable>
        <Pressable onPress={onSave} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} accessibilityLabel={t('vehicleDetail.editor.save')} style={{ flex: 1.4, minHeight: 48, borderRadius: 24, backgroundColor: Brand.orange, opacity: busy ? 0.6 : 1, alignItems: 'center', justifyContent: 'center' }}>
          <HText weight="semibold" size={14} color={Brand.white}>
            {busy ? t('vehicleDetail.editor.saving') : t('vehicleDetail.editor.save')}
          </HText>
        </Pressable>
      </View>
    </View>
  );
}

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

  function save() {
    setTouched(true);
    setError(null);
    if (Object.keys(errors).length > 0) return;
    if (!hasSpecsChanges(vehicle, draft)) return onClose();
    update.mutate({ id: vehicle.id, patch: specsPatch(vehicle, draft) }, { onSuccess: onClose, onError: () => setError(t('vehicleDetail.editor.saveError')) });
  }

  const label = (key: string) => t(`vehicle.fields.${key}`);
  return (
    <View style={CARD}>
      <HText font="display" weight="bold" size={17} accessibilityRole="header">
        {t('vehicleDetail.specs.title')}
      </HText>
      <View style={{ gap: 6 }}>
        <HText size={12} color={Palette.textSecondary}>
          {label('categorie')}
        </HText>
        <ChipGroup options={VEHICLE_CATEGORIES} selected={draft.categorie} getLabel={(value) => t(`vehicle.category.${value}`)} onSelect={(value) => set('categorie', value)} />
      </View>
      <View style={{ gap: 6 }}>
        <HText size={12} color={Palette.textSecondary}>
          {label('transmission')}
        </HText>
        <ChipGroup options={VEHICLE_TRANSMISSIONS} selected={draft.transmission} getLabel={(value) => t(`vehicle.transmission.${value}`)} onSelect={(value) => set('transmission', value)} />
      </View>
      <View style={{ gap: 6 }}>
        <HText size={12} color={Palette.textSecondary}>
          {label('carburant')}
        </HText>
        <ChipGroup options={FUEL_TYPES} selected={draft.carburant} getLabel={(value) => t(`vehicle.fuel.${value}`)} onSelect={(value) => set('carburant', value)} />
      </View>
      <TextField label={label('kilometrage')} value={draft.kilometrage} onChangeText={(value) => set('kilometrage', value)} keyboardType="number-pad" error={message('kilometrage')} />
      <TextField label={label('couleur')} value={draft.couleur} onChangeText={(value) => set('couleur', value)} />
      <TextField label={label('annee')} value={draft.annee} onChangeText={(value) => set('annee', value)} keyboardType="number-pad" error={message('annee')} />
      <TextField label={label('nombrePlaces')} value={draft.nombrePlaces} onChangeText={(value) => set('nombrePlaces', value)} keyboardType="number-pad" error={message('nombrePlaces')} />
      <TextField label={label('puissanceFiscale')} value={draft.puissanceFiscale} onChangeText={(value) => set('puissanceFiscale', value.replace(/\D/g, ''))} keyboardType="number-pad" error={message('puissanceFiscale')} />
      <Buttons onSave={save} onCancel={onClose} busy={update.isPending} error={error} />
    </View>
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
    <View style={CARD}>
      <HText font="display" weight="bold" size={17} accessibilityRole="header">
        {t('vehicleDetail.documents.title')}
      </HText>
      {EDITABLE_DOCUMENT_TYPES.map((type: EditableDocumentType) => (
        <DocumentPhotoField
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
      <Buttons onSave={() => void save()} onCancel={onClose} busy={busy} error={error} />
    </View>
  );
}
