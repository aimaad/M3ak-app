import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { ChipGroup } from '@/components/chip-group';
import { DocumentPhotoField } from '@/components/document-photo-field';
import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/text-field';
import { useMyProfile, useMyAgency } from '@/features/agency/hooks';
import { useBranches } from '@/features/branches/hooks';
import { findDocument } from '@/features/storage/documents';
import { useLanguage } from '@/i18n/use-language';

import { VEHICLE_DOCUMENTS_BUCKET } from './api';
import { canManuallyChangeStatus } from './status-transitions';
import {
  FUEL_TYPES,
  MANUAL_VEHICLE_STATUSES,
  VEHICLE_CATEGORIES,
  VEHICLE_DOCUMENT_TYPES,
  VEHICLE_TRANSMISSIONS,
} from './types';
import { isFormValid, toVehicleInput, validateVehicleForm, type VehicleFormValues } from './validation';
import { VehiclePhotoPicker } from './vehicle-photo-picker';
import type {
  PendingVehicleDocument,
  VehicleCategory,
  VehicleDocument,
  VehicleInput,
  VehicleStatus,
  VehicleTransmission,
} from './types';

type VehicleFormProps = {
  initialValues?: VehicleFormValues;
  existingDocuments?: VehicleDocument[];
  existingPhotosCount?: number;
  initialBranchId?: string | null;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  submitError?: string | null;
  onSubmit: (
    input: VehicleInput,
    pendingDocuments: PendingVehicleDocument[],
    pendingPhotos: string[]
  ) => void;
};

const EMPTY_VALUES: VehicleFormValues = {
  marque: '',
  modele: '',
  immatriculation: '',
  vin: '',
  finition: '',
  annee: '',
  dateMiseEnCirculation: '',
  puissanceFiscale: '',
  categorie: null,
  couleur: '',
  nombrePlaces: '',
  transmission: null,
  carburant: 'essence',
  kilometrage: '',
  niveauCarburant: '',
  prixJour: '',
  prixSemaine: '',
  prixMois: '',
  description: '',
  statut: 'disponible',
};

function SectionTitle({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" className="mt-2">
      {children}
    </ThemedText>
  );
}

export function VehicleForm({
  initialValues,
  existingDocuments = [],
  existingPhotosCount = 0,
  initialBranchId = null,
  submitLabel,
  submittingLabel,
  isSubmitting,
  submitError,
  onSubmit,
}: VehicleFormProps) {
  const { t } = useLanguage();
  const [values, setValues] = useState<VehicleFormValues>(initialValues ?? EMPTY_VALUES);
  const [touched, setTouched] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<PendingVehicleDocument[]>([]);
  const [documentExpiries, setDocumentExpiries] = useState<Record<string, string>>({});
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [branchId, setBranchId] = useState<string | null>(initialBranchId);

  // Seuls les membres sans filiale (accès à toutes les filiales) choisissent
  // la filiale du véhicule ; un employé de filiale est rattaché automatiquement.
  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const profileQuery = useMyProfile(agencyId);
  const branchesQuery = useBranches(agencyId);
  const branches = branchesQuery.data ?? [];
  const canChooseBranch = profileQuery.data?.branchId === null && branches.length > 0;

  const errors = validateVehicleForm(values);
  const showErrors = touched;
  const statusLocked = !canManuallyChangeStatus(values.statut);

  function update<K extends keyof VehicleFormValues>(key: K, value: VehicleFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function pickDocument(type: PendingVehicleDocument['type'], localUri: string) {
    setPendingDocuments((prev) => [...prev.filter((doc) => doc.type !== type), { type, localUri, expiresAt: null }]);
  }

  function handleSubmit() {
    setTouched(true);
    if (!isFormValid(errors)) return;

    const documentsWithExpiry = pendingDocuments.map((doc) => ({
      ...doc,
      expiresAt: documentExpiries[doc.type]?.trim() ? documentExpiries[doc.type] : null,
    }));
    onSubmit(
      canChooseBranch ? { ...toVehicleInput(values), branchId } : toVehicleInput(values),
      documentsWithExpiry,
      pendingPhotos
    );
  }

  return (
    <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
      <SectionTitle>{t('vehicle.sections.general')}</SectionTitle>
      <TextField
        label={t('vehicle.fields.marque')}
        value={values.marque}
        onChangeText={(v) => update('marque', v)}
        error={showErrors && errors.marque ? t(`vehicle.form.errors.${errors.marque}`) : undefined}
      />
      <TextField
        label={t('vehicle.fields.modele')}
        value={values.modele}
        onChangeText={(v) => update('modele', v)}
        error={showErrors && errors.modele ? t(`vehicle.form.errors.${errors.modele}`) : undefined}
      />
      <TextField
        label={t('vehicle.fields.immatriculation')}
        value={values.immatriculation}
        onChangeText={(v) => update('immatriculation', v)}
        error={
          showErrors && errors.immatriculation
            ? t(`vehicle.form.errors.${errors.immatriculation}`)
            : undefined
        }
      />
      <TextField
        label={t('vehicle.fields.annee')}
        value={values.annee}
        onChangeText={(v) => update('annee', v)}
        keyboardType="number-pad"
        error={showErrors && errors.annee ? t(`vehicle.form.errors.${errors.annee}`) : undefined}
      />
      <TextField
        label={t('vehicle.fields.dateMiseEnCirculation')}
        value={values.dateMiseEnCirculation ?? ''}
        onChangeText={(v) => update('dateMiseEnCirculation', v)}
        placeholder={t('vehicle.fields.datePlaceholder')}
        error={showErrors && errors.dateMiseEnCirculation ? t(`vehicle.form.errors.${errors.dateMiseEnCirculation}`) : undefined}
      />
      <TextField
        label={t('vehicle.fields.puissanceFiscale')}
        value={values.puissanceFiscale ?? ''}
        onChangeText={(v) => update('puissanceFiscale', v)}
        keyboardType="number-pad"
        error={showErrors && errors.puissanceFiscale ? t(`vehicle.form.errors.${errors.puissanceFiscale}`) : undefined}
      />
      <TextField
        label={t('vehicle.fields.finition')}
        value={values.finition}
        onChangeText={(v) => update('finition', v)}
        placeholder={t('vehicle.fields.optionalPlaceholder')}
      />
      <TextField
        label={t('vehicle.fields.vin')}
        value={values.vin}
        onChangeText={(v) => update('vin', v)}
        autoCapitalize="characters"
        placeholder={t('vehicle.fields.optionalPlaceholder')}
      />
      <TextField
        label={t('vehicle.fields.couleur')}
        value={values.couleur}
        onChangeText={(v) => update('couleur', v)}
      />

      <SectionTitle>{t('vehicle.sections.caracteristiques')}</SectionTitle>
      <View className="gap-1.5">
        <ThemedText type="small" themeColor="textSecondary">
          {t('vehicle.fields.categorie')}
        </ThemedText>
        <ChipGroup
          options={VEHICLE_CATEGORIES}
          selected={values.categorie}
          getLabel={(c: VehicleCategory) => t(`vehicle.category.${c}`)}
          onSelect={(c) => update('categorie', c)}
        />
      </View>
      <View className="gap-1.5">
        <ThemedText type="small" themeColor="textSecondary">
          {t('vehicle.fields.transmission')}
        </ThemedText>
        <ChipGroup
          options={VEHICLE_TRANSMISSIONS}
          selected={values.transmission}
          getLabel={(tr: VehicleTransmission) => t(`vehicle.transmission.${tr}`)}
          onSelect={(tr) => update('transmission', tr)}
        />
      </View>
      {canChooseBranch ? (
        <View className="gap-1.5">
          <ThemedText type="small" themeColor="textSecondary">
            {t('vehicle.fields.branch')}
          </ThemedText>
          <View className="flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => setBranchId(null)}
              className={`rounded-full border px-4 py-2 ${
                branchId === null ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'
              }`}
            >
              <ThemedText type="small" style={{ color: branchId === null ? '#ffffff' : '#211A2E' }}>
                {t('vehicle.fields.allBranches')}
              </ThemedText>
            </Pressable>
            {branches.map((branch) => {
              const isSelected = branchId === branch.id;
              return (
                <Pressable
                  key={branch.id}
                  onPress={() => setBranchId(branch.id)}
                  className={`rounded-full border px-4 py-2 ${
                    isSelected ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'
                  }`}
                >
                  <ThemedText type="small" style={{ color: isSelected ? '#ffffff' : '#211A2E' }}>
                    {branch.nom}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <View className="gap-1.5">
        <ThemedText type="small" themeColor="textSecondary">
          {t('vehicle.fields.carburant')}
        </ThemedText>
        <ChipGroup options={FUEL_TYPES} selected={values.carburant} getLabel={(f) => t(`vehicle.fuel.${f}`)} onSelect={(f) => update('carburant', f)} />
      </View>
      <TextField
        label={t('vehicle.fields.nombrePlaces')}
        value={values.nombrePlaces}
        onChangeText={(v) => update('nombrePlaces', v)}
        keyboardType="number-pad"
        error={showErrors && errors.nombrePlaces ? t(`vehicle.form.errors.${errors.nombrePlaces}`) : undefined}
      />
      <TextField
        label={t('vehicle.fields.niveauCarburant')}
        value={values.niveauCarburant}
        onChangeText={(v) => update('niveauCarburant', v)}
        keyboardType="number-pad"
        placeholder={t('vehicle.fields.niveauCarburantPlaceholder')}
        error={
          showErrors && errors.niveauCarburant ? t(`vehicle.form.errors.${errors.niveauCarburant}`) : undefined
        }
      />

      <SectionTitle>{t('vehicle.sections.tarification')}</SectionTitle>
      <TextField
        label={t('vehicle.fields.prixJour')}
        value={values.prixJour}
        onChangeText={(v) => update('prixJour', v)}
        keyboardType="number-pad"
        error={showErrors && errors.prixJour ? t(`vehicle.form.errors.${errors.prixJour}`) : undefined}
      />
      <TextField
        label={t('vehicle.fields.prixSemaine')}
        value={values.prixSemaine}
        onChangeText={(v) => update('prixSemaine', v)}
        keyboardType="number-pad"
        placeholder={t('vehicle.fields.optionalPlaceholder')}
        error={showErrors && errors.prixSemaine ? t(`vehicle.form.errors.${errors.prixSemaine}`) : undefined}
      />
      <TextField
        label={t('vehicle.fields.prixMois')}
        value={values.prixMois}
        onChangeText={(v) => update('prixMois', v)}
        keyboardType="number-pad"
        placeholder={t('vehicle.fields.optionalPlaceholder')}
        error={showErrors && errors.prixMois ? t(`vehicle.form.errors.${errors.prixMois}`) : undefined}
      />

      <SectionTitle>{t('vehicle.sections.photos')}</SectionTitle>
      <VehiclePhotoPicker
        label={t('vehicle.photosHint')}
        localUris={pendingPhotos}
        onAdd={(uri) => setPendingPhotos((prev) => [...prev, uri])}
        onRemove={(uri) => setPendingPhotos((prev) => prev.filter((u) => u !== uri))}
      />
      {existingPhotosCount > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('vehicle.existingPhotosHint', { count: existingPhotosCount })}
        </ThemedText>
      ) : null}

      <SectionTitle>{t('vehicle.sections.documents')}</SectionTitle>
      {VEHICLE_DOCUMENT_TYPES.map((type) => {
        const existing = findDocument(existingDocuments, type);
        return (
          <View key={type} className="gap-2">
            <DocumentPhotoField
              label={t(`vehicle.documents.${type}`)}
              bucket={VEHICLE_DOCUMENTS_BUCKET}
              localUri={pendingDocuments.find((d) => d.type === type)?.localUri ?? null}
              existingPath={existing?.path}
              onPick={(uri) => pickDocument(type, uri)}
            />
            <TextField
              placeholder={t('vehicle.documentExpiryPlaceholder')}
              value={documentExpiries[type] ?? ''}
              onChangeText={(v) => setDocumentExpiries((prev) => ({ ...prev, [type]: v }))}
            />
          </View>
        );
      })}

      <SectionTitle>{t('vehicle.sections.operationnel')}</SectionTitle>
      <TextField
        label={t('vehicle.fields.kilometrage')}
        value={values.kilometrage}
        onChangeText={(v) => update('kilometrage', v)}
        keyboardType="number-pad"
        error={
          showErrors && errors.kilometrage ? t(`vehicle.form.errors.${errors.kilometrage}`) : undefined
        }
      />

      <View className="gap-1.5">
        <ThemedText type="small" themeColor="textSecondary">
          {t('vehicle.fields.statut')}
        </ThemedText>
        {statusLocked ? (
          <View className="rounded-2xl border border-dashed border-[#EAE5F2] bg-white px-4 py-3">
            <ThemedText type="small" themeColor="textSecondary">
              {t('vehicle.statusLockedHint', { status: t(`flotte.status.${values.statut}`) })}
            </ThemedText>
          </View>
        ) : (
          <ChipGroup
            options={MANUAL_VEHICLE_STATUSES}
            selected={values.statut}
            getLabel={(s: VehicleStatus) => t(`flotte.status.${s}`)}
            onSelect={(s) => update('statut', s)}
          />
        )}
      </View>

      <TextField
        label={t('vehicle.fields.description')}
        value={values.description}
        onChangeText={(v) => update('description', v)}
        multiline
        numberOfLines={3}
        className="min-h-20"
      />

      {submitError ? (
        <View className="rounded-2xl bg-[#FEE2E2] px-4 py-3">
          <ThemedText type="small" style={{ color: '#DC2626' }}>
            {submitError}
          </ThemedText>
        </View>
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
