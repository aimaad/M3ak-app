import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ChipGroup } from '@/components/chip-group';
import { DocumentPhotoField } from '@/components/document-photo-field';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency, useMyProfile } from '@/features/agency/hooks';
import { useBranches } from '@/features/branches/hooks';
import { mergeDocuments } from '@/features/storage/documents';
import { takeVehicleCreationDraft, type VehicleCreationDraft } from '@/features/vehicles/creation-draft';
import { suggestDailyPrice } from '@/features/vehicles/pricing-suggestion';
import {
  findDuplicateVehicle,
  uploadVehicleDocument,
  uploadVehiclePhoto,
  VEHICLE_DOCUMENTS_BUCKET,
} from '@/features/vehicles/api';
import { useCreateVehicle, useUpdateVehicleDocuments, useUpdateVehiclePhotos, useVehicles } from '@/features/vehicles/hooks';
import { canManuallyChangeStatus } from '@/features/vehicles/status-transitions';
import {
  FUEL_TYPES,
  MANUAL_VEHICLE_STATUSES,
  VEHICLE_CATEGORIES,
  VEHICLE_TRANSMISSIONS,
  type PendingVehicleDocument,
  type Vehicle,
  type VehicleStatus,
} from '@/features/vehicles/types';
import { DuplicateVehicleCard } from '@/features/vehicles/duplicate-vehicle-card';
import { findDuplicateInList } from '@/features/vehicles/duplicates';
import { duplicateVehicleField, toVehicleInput, validateVehicleForm, type VehicleFormValues } from '@/features/vehicles/validation';
import { VehiclePhotoPicker } from '@/features/vehicles/vehicle-photo-picker';
import { useLanguage } from '@/i18n/use-language';

type FormState = {
  immatriculation: string;
  vin: string;
  marque: string;
  modele: string;
  finition: string;
  annee: string;
  dateMiseEnCirculation: string;
  puissanceFiscale: string;
  categorie: (typeof VEHICLE_CATEGORIES)[number] | null;
  couleur: string;
  nombrePlaces: string;
  transmission: (typeof VEHICLE_TRANSMISSIONS)[number] | null;
  carburant: (typeof FUEL_TYPES)[number];
  kilometrage: string;
  niveauCarburant: string;
  prixJour: string;
  description: string;
  statut: VehicleStatus;
};

function draftToFormState(draft: VehicleCreationDraft | null): FormState {
  return {
    immatriculation: draft?.immatriculation ?? '',
    vin: draft?.vin ?? '',
    marque: draft?.marque ?? '',
    modele: draft?.modele ?? '',
    finition: draft?.finition ?? '',
    annee: draft?.annee != null ? String(draft.annee) : '',
    dateMiseEnCirculation: draft?.dateMiseEnCirculation ?? '',
    puissanceFiscale: draft?.puissanceFiscale != null ? String(draft.puissanceFiscale) : '',
    categorie: draft?.categorie ?? null,
    couleur: draft?.couleur ?? '',
    nombrePlaces: draft?.nombrePlaces != null ? String(draft.nombrePlaces) : '',
    transmission: null,
    carburant: draft?.carburant ?? 'essence',
    kilometrage: '0',
    niveauCarburant: '',
    prixJour: '',
    description: '',
    statut: 'disponible',
  };
}

export default function FinaliserVehiculeScreen() {
  const { t } = useLanguage();
  const [draft] = useState(() => takeVehicleCreationDraft());
  const [values, setValues] = useState<FormState>(() => draftToFormState(draft));
  const [touched, setTouched] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<PendingVehicleDocument[]>(
    draft?.carteGrisePendingDocuments ?? []
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdVehicle, setCreatedVehicle] = useState<Vehicle | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ field: 'immatriculation' | 'vin'; vehicle: Vehicle } | null>(
    null
  );

  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const profileQuery = useMyProfile(agencyId);
  const branchesQuery = useBranches(agencyId);
  const branches = branchesQuery.data ?? [];
  const canChooseBranch = profileQuery.data?.branchId === null && branches.length > 0;
  const vehiclesQuery = useVehicles();

  const createVehicle = useCreateVehicle();
  const updateDocuments = useUpdateVehicleDocuments();
  const updatePhotos = useUpdateVehiclePhotos();

  const priceSuggestion = useMemo(
    () => suggestDailyPrice(vehiclesQuery.data ?? [], values.categorie),
    [vehiclesQuery.data, values.categorie]
  );

  const missing = {
    immatriculation: !values.immatriculation.trim(),
    marque: !values.marque.trim(),
    modele: !values.modele.trim(),
    categorie: !values.categorie,
    prixJour: !values.prixJour.trim() || Number(values.prixJour) <= 0,
  };
  const cardErrors = validateVehicleForm({
    marque: 'x', modele: 'x', immatriculation: 'x', vin: '', finition: '', annee: '',
    dateMiseEnCirculation: values.dateMiseEnCirculation, puissanceFiscale: values.puissanceFiscale,
    categorie: values.categorie, couleur: '', nombrePlaces: '', transmission: values.transmission,
    carburant: values.carburant, kilometrage: '0', niveauCarburant: '', prixJour: '1', prixSemaine: '', prixMois: '',
    description: '', statut: values.statut,
  } as VehicleFormValues);
  const isValid = !Object.values(missing).some(Boolean) && !cardErrors.dateMiseEnCirculation && !cardErrors.puissanceFiscale;
  const statusLocked = !canManuallyChangeStatus(values.statut);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // Vérifie en continu (avec un léger délai) qu'on ne crée pas un doublon —
  // garde-fou final avant l'enregistrement, quel que soit le chemin suivi
  // pour arriver ici (scan, plaque, ou saisie manuelle).
  useEffect(() => {
    if (!agencyId || !values.immatriculation.trim()) return undefined;

    const plate = values.immatriculation.trim();
    const vin = values.vin.trim() || null;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const found = await findDuplicateVehicle(agencyId, plate, vin);
        if (!cancelled) setDuplicateWarning(found);
      } catch {
        // Le contrôle serveur à l'enregistrement reste le garde-fou définitif.
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [agencyId, values.immatriculation, values.vin]);

  // Comparaison locale tolérante (espaces, barres, casse) + contrôle serveur ; une plaque effacée ne bloque plus.
  const localDuplicate = useMemo(
    () => findDuplicateInList(vehiclesQuery.data ?? [], { immatriculation: values.immatriculation, vin: values.vin }),
    [vehiclesQuery.data, values.immatriculation, values.vin]
  );
  const activeDuplicateWarning = values.immatriculation.trim() ? (localDuplicate ?? duplicateWarning) : null;

  async function handleSubmit() {
    setTouched(true);
    setSubmitError(null);
    if (!isValid || !agencyId || activeDuplicateWarning || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const input = {
        ...toVehicleInput({
          marque: values.marque,
          modele: values.modele,
          immatriculation: values.immatriculation,
          vin: values.vin,
          finition: values.finition,
          annee: values.annee,
          dateMiseEnCirculation: values.dateMiseEnCirculation,
          puissanceFiscale: values.puissanceFiscale,
          categorie: values.categorie,
          couleur: values.couleur,
          nombrePlaces: values.nombrePlaces,
          transmission: values.transmission,
          carburant: values.carburant,
          kilometrage: values.kilometrage || '0',
          niveauCarburant: values.niveauCarburant,
          prixJour: values.prixJour,
          prixSemaine: '',
          prixMois: '',
          description: values.description,
          statut: values.statut,
        }),
        ...(canChooseBranch ? { branchId } : {}),
      };

      const vehicle = await createVehicle.mutateAsync({ agencyId, input });

      if (pendingDocuments.length > 0) {
        try {
          const uploaded = await Promise.all(
            pendingDocuments.map((doc) => uploadVehicleDocument(agencyId, vehicle.id, doc.type, doc.localUri, doc.expiresAt))
          );
          await updateDocuments.mutateAsync({ id: vehicle.id, documents: mergeDocuments(vehicle.documents, uploaded) });
        } catch {
          // Le véhicule est créé ; l'employé pourra réessayer l'envoi du document depuis sa fiche.
        }
      }

      if (pendingPhotos.length > 0) {
        try {
          const uploaded = await Promise.all(pendingPhotos.map((uri) => uploadVehiclePhoto(agencyId, vehicle.id, uri)));
          await updatePhotos.mutateAsync({ id: vehicle.id, photos: [...vehicle.photos, ...uploaded] });
        } catch {
          // Idem pour les photos.
        }
      }

      setCreatedVehicle(vehicle);
    } catch (error) {
      const field = duplicateVehicleField(error);
      setSubmitError(
        field === 'vin'
          ? t('vehicle.form.duplicateVinError')
          : field === 'immatriculation'
            ? t('vehicle.form.duplicatePlateError')
            : t('vehicle.form.createError')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAddAnother() {
    setValues(draftToFormState(null));
    setTouched(false);
    setBranchId(null);
    setPendingPhotos([]);
    setPendingDocuments([]);
    setSubmitError(null);
    setCreatedVehicle(null);
    setDuplicateWarning(null);
  }

  if (createdVehicle) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1 items-center justify-center gap-6 px-8" edges={['top', 'left', 'right']}>
          <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: M3akPalette.successLight }}>
            <Ionicons name="checkmark" size={32} color={M3akPalette.success} />
          </View>
          <ThemedText type="subtitle" className="text-center font-cairo-semibold">
            {t('vehicle.quickCreate.successTitle')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" className="text-center">
            {t('vehicle.quickCreate.successBody', { plate: createdVehicle.immatriculation })}
          </ThemedText>
          <View className="w-full gap-2">
            <Button label={t('vehicle.quickCreate.viewVehicle')} onPress={() => router.replace(`/flotte/${createdVehicle.id}`)} />
            <Button label={t('vehicle.quickCreate.addAnother')} variant="secondary" onPress={handleAddAnother} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('vehicle.quickCreate.finalizeTitle')} showBack />

        <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
          {draft?.uncertainFields && draft.uncertainFields.length > 0 ? (
            <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: M3akPalette.warningLight }}>
              <ThemedText type="small" style={{ color: M3akPalette.warning }}>
                {t('vehicle.quickCreate.reviewBeforeSave')}
              </ThemedText>
            </View>
          ) : null}

          <TextField
            label={t('vehicle.fields.immatriculation')}
            value={values.immatriculation}
            onChangeText={(v) => update('immatriculation', v)}
            autoCapitalize="characters"
            error={touched && missing.immatriculation ? t('vehicle.form.errors.required') : undefined}
          />

          {activeDuplicateWarning ? <DuplicateVehicleCard duplicate={activeDuplicateWarning} /> : null}

          <TextField
            label={t('vehicle.fields.marque')}
            value={values.marque}
            onChangeText={(v) => update('marque', v)}
            error={touched && missing.marque ? t('vehicle.form.errors.required') : undefined}
          />
          <TextField
            label={t('vehicle.fields.modele')}
            value={values.modele}
            onChangeText={(v) => update('modele', v)}
            error={touched && missing.modele ? t('vehicle.form.errors.required') : undefined}
          />

          <View className="gap-1.5">
            <ThemedText type="small" themeColor="textSecondary">
              {t('vehicle.fields.categorie')}
            </ThemedText>
            <ChipGroup
              options={VEHICLE_CATEGORIES}
              selected={values.categorie}
              getLabel={(c) => t(`vehicle.category.${c}`)}
              onSelect={(c) => update('categorie', c)}
            />
            {touched && missing.categorie ? (
              <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                {t('vehicle.form.errors.required')}
              </ThemedText>
            ) : null}
          </View>

          <View className="gap-1">
            <TextField
              label={t('vehicle.fields.prixJour')}
              value={values.prixJour}
              onChangeText={(v) => update('prixJour', v)}
              keyboardType="number-pad"
              error={touched && missing.prixJour ? t('vehicle.form.errors.invalid_price') : undefined}
            />
            {priceSuggestion !== null && !values.prixJour.trim() ? (
              <Pressable onPress={() => update('prixJour', String(priceSuggestion))}>
                <ThemedText type="small" themeColor="primary">
                  {t('vehicle.quickCreate.priceSuggestion', { price: priceSuggestion })}
                </ThemedText>
              </Pressable>
            ) : null}
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
                {branches.map((branch) => (
                  <Pressable
                    key={branch.id}
                    onPress={() => setBranchId(branch.id)}
                    className={`rounded-full border px-4 py-2 ${
                      branchId === branch.id ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'
                    }`}
                  >
                    <ThemedText type="small" style={{ color: branchId === branch.id ? '#ffffff' : '#211A2E' }}>
                      {branch.nom}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

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
                getLabel={(s) => t(`flotte.status.${s}`)}
                onSelect={(s) => update('statut', s)}
              />
            )}
          </View>

          <ThemedText type="smallBold" className="mt-2">
            {t('vehicle.sections.photos')}
          </ThemedText>
          <VehiclePhotoPicker
            label={t('vehicle.photosHint')}
            localUris={pendingPhotos}
            onAdd={(uri) => setPendingPhotos((prev) => [...prev, uri])}
            onRemove={(uri) => setPendingPhotos((prev) => prev.filter((u) => u !== uri))}
          />

          <Pressable onPress={() => setShowMore((prev) => !prev)} className="flex-row items-center gap-1 py-2">
            <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={16} color={M3akPalette.mauve} />
            <ThemedText type="small" themeColor="primary">
              {t('vehicle.quickCreate.moreInfo')}
            </ThemedText>
          </Pressable>

          {showMore ? (
            <View className="gap-4">
              <TextField label={t('vehicle.fields.couleur')} value={values.couleur} onChangeText={(v) => update('couleur', v)} />
              <TextField
                label={t('vehicle.fields.annee')}
                value={values.annee}
                onChangeText={(v) => update('annee', v)}
                keyboardType="number-pad"
              />
              <TextField
                label={t('vehicle.fields.dateMiseEnCirculation')}
                value={values.dateMiseEnCirculation}
                onChangeText={(v) => update('dateMiseEnCirculation', v)}
                error={touched && cardErrors.dateMiseEnCirculation ? t('vehicle.form.errors.invalid_date') : undefined}
                placeholder={t('vehicle.fields.datePlaceholder')}
              />
              <TextField
                label={t('vehicle.fields.puissanceFiscale')}
                value={values.puissanceFiscale}
                onChangeText={(v) => update('puissanceFiscale', v)}
                error={touched && cardErrors.puissanceFiscale ? t('vehicle.form.errors.invalid_cv') : undefined}
                keyboardType="number-pad"
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
              <View className="gap-1.5">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.fields.transmission')}
                </ThemedText>
                <ChipGroup
                  options={VEHICLE_TRANSMISSIONS}
                  selected={values.transmission}
                  getLabel={(tr) => t(`vehicle.transmission.${tr}`)}
                  onSelect={(tr) => update('transmission', tr)}
                />
              </View>
              <View className="gap-1.5">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.fields.carburant')}
                </ThemedText>
                <ChipGroup
                  options={FUEL_TYPES}
                  selected={values.carburant}
                  getLabel={(f) => t(`vehicle.fuel.${f}`)}
                  onSelect={(f) => update('carburant', f)}
                />
              </View>
              <TextField
                label={t('vehicle.fields.nombrePlaces')}
                value={values.nombrePlaces}
                onChangeText={(v) => update('nombrePlaces', v)}
                keyboardType="number-pad"
              />
              <TextField
                label={t('vehicle.fields.niveauCarburant')}
                value={values.niveauCarburant}
                onChangeText={(v) => update('niveauCarburant', v)}
                keyboardType="number-pad"
                placeholder={t('vehicle.fields.niveauCarburantPlaceholder')}
              />
              <TextField
                label={t('vehicle.fields.kilometrage')}
                value={values.kilometrage}
                onChangeText={(v) => update('kilometrage', v)}
                keyboardType="number-pad"
              />
              <TextField
                label={t('vehicle.fields.description')}
                value={values.description}
                onChangeText={(v) => update('description', v)}
                multiline
                numberOfLines={3}
                className="min-h-20"
              />

              <ThemedText type="smallBold">{t('vehicle.sections.documents')}</ThemedText>
              <DocumentPhotoField
                label={t('vehicle.documents.carte_grise')}
                bucket={VEHICLE_DOCUMENTS_BUCKET}
                localUri={pendingDocuments.find((d) => d.type === 'carte_grise')?.localUri ?? null}
                onPick={(uri) =>
                  setPendingDocuments((prev) => [...prev.filter((d) => d.type !== 'carte_grise'), { type: 'carte_grise', localUri: uri, expiresAt: null }])
                }
              />
              <DocumentPhotoField
                label={t('vehicle.documents.carte_grise_verso')}
                bucket={VEHICLE_DOCUMENTS_BUCKET}
                localUri={pendingDocuments.find((d) => d.type === 'carte_grise_verso')?.localUri ?? null}
                onPick={(uri) =>
                  setPendingDocuments((prev) => [...prev.filter((d) => d.type !== 'carte_grise_verso'), { type: 'carte_grise_verso', localUri: uri, expiresAt: null }])
                }
              />
              <DocumentPhotoField
                label={t('vehicle.documents.assurance')}
                bucket={VEHICLE_DOCUMENTS_BUCKET}
                localUri={pendingDocuments.find((d) => d.type === 'assurance')?.localUri ?? null}
                onPick={(uri) =>
                  setPendingDocuments((prev) => [...prev.filter((d) => d.type !== 'assurance'), { type: 'assurance', localUri: uri, expiresAt: null }])
                }
              />
              <DocumentPhotoField
                label={t('vehicle.documents.visite_technique')}
                bucket={VEHICLE_DOCUMENTS_BUCKET}
                localUri={pendingDocuments.find((d) => d.type === 'visite_technique')?.localUri ?? null}
                onPick={(uri) =>
                  setPendingDocuments((prev) => [...prev.filter((d) => d.type !== 'visite_technique'), { type: 'visite_technique', localUri: uri, expiresAt: null }])
                }
              />
            </View>
          ) : null}

          {submitError ? (
            <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: M3akPalette.dangerLight }}>
              <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                {submitError}
              </ThemedText>
            </View>
          ) : null}

          <Button
            label={isSubmitting ? t('vehicle.form.saving') : t('vehicle.quickCreate.saveAction')}
            onPress={handleSubmit}
            disabled={isSubmitting || !!activeDuplicateWarning}
            loading={isSubmitting}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
