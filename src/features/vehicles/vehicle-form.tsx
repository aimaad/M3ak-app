import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Palette } from '@/constants/theme';
import { useMyAgency, useMyProfile } from '@/features/agency/hooks';
import { useBranches } from '@/features/branches/hooks';
import { clampPercentInput } from '@/lib/percent';
import { useLanguage } from '@/i18n/use-language';

import { Chips, ErrorBanner, Field, FieldGroup, FormActions, FormCard } from './detail/form-ui';
import { canSeePrices } from './fleet-card';
import { canManuallyChangeStatus } from './status-transitions';
import { FUEL_TYPES, MANUAL_VEHICLE_STATUSES, VEHICLE_CATEGORIES, VEHICLE_TRANSMISSIONS, type VehicleCategory, type VehicleInput, type VehicleStatus, type VehicleTransmission } from './types';
import { useSectionScroll } from './use-section-scroll';
import { toVehicleInput, validateVehicleForm, type VehicleFormValues } from './validation';

type VehicleFormProps = {
  initialValues?: VehicleFormValues;
  /** Pour les liens « Gérer les photos » / « Gérer les documents » ; absent = section masquée. */
  vehicleId?: string;
  /** Ouvre le formulaire directement sur ce champ (tuile « À compléter » de la fiche technique). */
  scrollToField?: string | null;
  initialBranchId?: string | null;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  submitError?: string | null;
  onSubmit: (input: VehicleInput) => void;
};

const EMPTY_VALUES: VehicleFormValues = {
  marque: '', modele: '', immatriculation: '', vin: '', finition: '', annee: '', dateMiseEnCirculation: '', puissanceFiscale: '', categorie: null,
  couleur: '', nombrePlaces: '', transmission: null, carburant: 'essence', kilometrage: '', niveauCarburant: '', prixJour: '', prixSemaine: '',
  prixMois: '', description: '', statut: 'disponible',
};

/** Libellé du champ en erreur, pour le bandeau de synthèse (clé de `vehicle.fields.*`). */
const FIELD_ORDER: (keyof VehicleFormValues)[] = ['marque', 'modele', 'immatriculation', 'annee', 'dateMiseEnCirculation', 'puissanceFiscale', 'nombrePlaces', 'kilometrage', 'niveauCarburant', 'prixJour', 'prixSemaine', 'prixMois'];

/** Formulaire complet de modification d'un véhicule : sections claires, barre « Enregistrer » toujours visible, bandeau des champs à corriger. */
export function VehicleForm({ initialValues, vehicleId, scrollToField = null, initialBranchId = null, submitLabel, submittingLabel, isSubmitting, submitError, onSubmit }: VehicleFormProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { scrollRef, onSectionLayout, onScrollBeginDrag } = useSectionScroll<string>(scrollToField);
  const [values, setValues] = useState<VehicleFormValues>(initialValues ?? EMPTY_VALUES);
  const [touched, setTouched] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(initialBranchId);
  const [initial] = useState(() => JSON.stringify([initialValues ?? EMPTY_VALUES, initialBranchId]));

  // Seuls les membres sans filiale (accès à toutes les filiales) choisissent la filiale du véhicule.
  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const profileQuery = useMyProfile(agencyId);
  const branches = useBranches(agencyId).data ?? [];
  const canChooseBranch = profileQuery.data?.branchId === null && branches.length > 0;
  const showPrices = canSeePrices(agencyQuery.data?.role);

  const errors = validateVehicleForm(values);
  const statusLocked = !canManuallyChangeStatus(values.statut);
  const dirty = JSON.stringify([values, branchId]) !== initial;
  // Le prix n'est pas modifiable (ni donc bloquant) pour qui ne le voit pas.
  const relevantErrors = FIELD_ORDER.filter((field) => (errors as Record<string, unknown>)[field] && (showPrices || !field.startsWith('prix')));

  function update<K extends keyof VehicleFormValues>(key: K, value: VehicleFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function handleSubmit() {
    setTouched(true);
    if (relevantErrors.length > 0) return;
    onSubmit(canChooseBranch ? { ...toVehicleInput(values), branchId } : toVehicleInput(values));
  }

  const message = (field: keyof VehicleFormValues) => (touched && (errors as Record<string, string | undefined>)[field] ? t(`vehicle.form.errors.${(errors as Record<string, string>)[field]}`) : undefined);
  const label = (key: string) => t(`vehicle.fields.${key}`);
  const errorSummary =
    touched && relevantErrors.length > 0
      ? t(relevantErrors.length === 1 ? 'vehicleForm.errorsOne' : 'vehicleForm.errorsMany', { count: relevantErrors.length, fields: relevantErrors.map((field) => label(field)).join(', ') })
      : null;

  const digits = (value: string) => value.replace(/\D/g, '');
  return (
    <View className="flex-1">
      <ScrollView ref={scrollRef} onScrollBeginDrag={onScrollBeginDrag} contentContainerClassName="gap-4 px-6 pb-6 pt-1" keyboardShouldPersistTaps="handled">
        {errorSummary ? <ErrorBanner>{errorSummary}</ErrorBanner> : null}
        {submitError ? <ErrorBanner>{submitError}</ErrorBanner> : null}

        <FormCard title={t('vehicleForm.sections.identity')}>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label={label('marque')} value={values.marque} onChangeText={(v) => update('marque', v)} error={message('marque')} />
            </View>
            <View className="flex-1">
              <Field label={label('modele')} value={values.modele} onChangeText={(v) => update('modele', v)} error={message('modele')} />
            </View>
          </View>
          <View onLayout={onSectionLayout('finition')}>
            <Field label={label('finition')} value={values.finition} onChangeText={(v) => update('finition', v)} optional />
          </View>
          <Field ltr label={label('immatriculation')} value={values.immatriculation} onChangeText={(v) => update('immatriculation', v)} error={message('immatriculation')} />
          <View onLayout={onSectionLayout('vin')}>
            <Field ltr label={label('vin')} value={values.vin} onChangeText={(v) => update('vin', v)} autoCapitalize="characters" optional />
          </View>
        </FormCard>

        <FormCard title={t('vehicleForm.sections.characteristics')}>
          <FieldGroup label={label('categorie')} onLayout={onSectionLayout('categorie')}>
            <Chips options={VEHICLE_CATEGORIES} selected={values.categorie} getLabel={(c: VehicleCategory) => t(`vehicle.category.${c}`)} onSelect={(c) => update('categorie', c)} />
          </FieldGroup>
          <FieldGroup label={label('transmission')} onLayout={onSectionLayout('transmission')}>
            <Chips options={VEHICLE_TRANSMISSIONS} selected={values.transmission} getLabel={(tr: VehicleTransmission) => t(`vehicle.transmission.${tr}`)} onSelect={(tr) => update('transmission', tr)} />
          </FieldGroup>
          <FieldGroup label={label('carburant')} onLayout={onSectionLayout('carburant')}>
            <Chips options={FUEL_TYPES} selected={values.carburant} getLabel={(f) => t(`vehicle.fuel.${f}`)} onSelect={(f) => update('carburant', f)} />
          </FieldGroup>
          <View className="flex-row gap-3">
            <View className="flex-1" onLayout={onSectionLayout('annee')}>
              <Field label={label('annee')} value={values.annee} onChangeText={(v) => update('annee', digits(v))} keyboardType="number-pad" maxLength={4} error={message('annee')} />
            </View>
            <View className="flex-1" onLayout={onSectionLayout('nombrePlaces')}>
              <Field label={label('nombrePlaces')} value={values.nombrePlaces} onChangeText={(v) => update('nombrePlaces', digits(v))} keyboardType="number-pad" maxLength={1} error={message('nombrePlaces')} />
            </View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1" onLayout={onSectionLayout('couleur')}>
              <Field label={label('couleur')} value={values.couleur} onChangeText={(v) => update('couleur', v)} />
            </View>
            <View className="flex-1" onLayout={onSectionLayout('puissanceFiscale')}>
              <Field label={label('puissanceFiscale')} value={values.puissanceFiscale ?? ''} onChangeText={(v) => update('puissanceFiscale', digits(v))} keyboardType="number-pad" maxLength={2} error={message('puissanceFiscale')} />
            </View>
          </View>
          <Field ltr label={label('dateMiseEnCirculation')} value={values.dateMiseEnCirculation ?? ''} onChangeText={(v) => update('dateMiseEnCirculation', v)} placeholder={t('vehicle.fields.datePlaceholder')} error={message('dateMiseEnCirculation')} />
        </FormCard>

        <FormCard title={t('vehicleForm.sections.usage')}>
          <View onLayout={onSectionLayout('kilometrage')}>
            <Field large label={label('kilometrage')} value={values.kilometrage} onChangeText={(v) => update('kilometrage', digits(v))} keyboardType="number-pad" unit={t('flotte.km')} error={message('kilometrage')} />
          </View>
          <View onLayout={onSectionLayout('niveauCarburant')}>
            <Field label={label('niveauCarburant')} value={values.niveauCarburant} onChangeText={(v) => update('niveauCarburant', clampPercentInput(v))} keyboardType="number-pad" unit="%" placeholder={t('vehicle.fields.niveauCarburantPlaceholder')} error={message('niveauCarburant')} />
          </View>
        </FormCard>

        {showPrices ? (
          <FormCard title={t('vehicle.sections.tarification')} subtitle={t('vehicleForm.pricingNote')}>
            <Field large label={label('prixJour')} value={values.prixJour} onChangeText={(v) => update('prixJour', digits(v))} keyboardType="number-pad" unit="MAD" error={message('prixJour')} />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label={label('prixSemaine')} value={values.prixSemaine} onChangeText={(v) => update('prixSemaine', digits(v))} keyboardType="number-pad" unit="MAD" optional error={message('prixSemaine')} />
              </View>
              <View className="flex-1">
                <Field label={label('prixMois')} value={values.prixMois} onChangeText={(v) => update('prixMois', digits(v))} keyboardType="number-pad" unit="MAD" optional error={message('prixMois')} />
              </View>
            </View>
          </FormCard>
        ) : null}

        <FormCard title={t('vehicleForm.sections.availability')}>
          <FieldGroup label={label('statut')}>
            {statusLocked ? (
              <View className="rounded-2xl border border-dashed border-border bg-surface px-4 py-3">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.statusLockedHint', { status: t(`flotte.status.${values.statut}`) })}
                </ThemedText>
              </View>
            ) : (
              <Chips options={MANUAL_VEHICLE_STATUSES} selected={values.statut} getLabel={(s: VehicleStatus) => t(`flotte.status.${s}`)} onSelect={(s) => update('statut', s)} />
            )}
          </FieldGroup>
          {canChooseBranch ? (
            <FieldGroup label={label('branch')}>
              <Chips
                options={['', ...branches.map((branch) => branch.id)]}
                selected={branchId ?? ''}
                getLabel={(id) => (id === '' ? t('vehicle.fields.allBranches') : (branches.find((branch) => branch.id === id)?.nom ?? ''))}
                onSelect={(id) => setBranchId(id === '' ? null : id)}
              />
            </FieldGroup>
          ) : null}
        </FormCard>

        <FormCard title={t('vehicleForm.sections.description')}>
          <Field label={label('description')} value={values.description} onChangeText={(v) => update('description', v)} multiline />
        </FormCard>

        {vehicleId ? (
          <FormCard title={t('vehicleForm.sections.media')} subtitle={t('vehicleForm.mediaHint')}>
            <View className="flex-row gap-3">
              <Pressable onPress={() => router.push({ pathname: '/flotte/[id]/photos', params: { id: vehicleId } })} accessibilityRole="button" className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-border bg-card px-3 py-3">
                <Ionicons name="images-outline" size={17} color={Brand.graphite} />
                <ThemedText type="smallBold">{t('vehicleForm.openPhotos')}</ThemedText>
              </Pressable>
              <Pressable onPress={() => router.push({ pathname: '/flotte/[id]', params: { id: vehicleId, edit: 'documents' } })} accessibilityRole="button" className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-border bg-card px-3 py-3">
                <Ionicons name="document-text-outline" size={17} color={Brand.graphite} />
                <ThemedText type="smallBold">{t('vehicleForm.openDocuments')}</ThemedText>
              </Pressable>
            </View>
          </FormCard>
        ) : null}
      </ScrollView>

      <View className="gap-3 border-t border-border bg-background px-6 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="flex-row items-center justify-center gap-2">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dirty ? Brand.orange : Palette.textMuted }} />
          <ThemedText type="small" themeColor="textSecondary">
            {dirty ? t('vehicleForm.dirty') : t('vehicleForm.clean')}
          </ThemedText>
        </View>
        <FormActions onSave={handleSubmit} onCancel={() => router.back()} busy={isSubmitting} disabled={!dirty} />
      </View>
    </View>
  );
}
