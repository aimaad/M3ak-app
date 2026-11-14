import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChipGroup } from '@/components/chip-group';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Brand, Palette } from '@/constants/theme';
import { useMyAgency, useMyProfile } from '@/features/agency/hooks';
import { useBranches } from '@/features/branches/hooks';
import { clampPercentInput } from '@/lib/percent';
import { useLanguage } from '@/i18n/use-language';

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

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View className="gap-4 rounded-3xl border border-border bg-card p-4">
      <View className="gap-0.5">
        <ThemedText type="smallBold" accessibilityRole="header">
          {title}
        </ThemedText>
        {note ? (
          <ThemedText type="small" themeColor="textSecondary">
            {note}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Labeled({ label, children, onLayout }: { label: string; children: ReactNode; onLayout?: (event: import('react-native').LayoutChangeEvent) => void }) {
  return (
    <View className="gap-1.5" onLayout={onLayout}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

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

  return (
    <View className="flex-1">
      <ScrollView ref={scrollRef} onScrollBeginDrag={onScrollBeginDrag} contentContainerClassName="gap-4 px-6 pb-6 pt-1" keyboardShouldPersistTaps="handled">
        {errorSummary || submitError ? (
          <View accessibilityRole="alert" className="gap-1 rounded-2xl bg-error-soft px-4 py-3">
            {errorSummary ? (
              <ThemedText type="small" style={{ color: Palette.error }}>
                {errorSummary}
              </ThemedText>
            ) : null}
            {submitError ? (
              <ThemedText type="small" style={{ color: Palette.error }}>
                {submitError}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        <Section title={t('vehicleForm.sections.identity')}>
          <TextField label={label('marque')} value={values.marque} onChangeText={(v) => update('marque', v)} error={message('marque')} />
          <TextField label={label('modele')} value={values.modele} onChangeText={(v) => update('modele', v)} error={message('modele')} />
          <View onLayout={onSectionLayout('finition')}>
            <TextField label={label('finition')} value={values.finition} onChangeText={(v) => update('finition', v)} optional />
          </View>
          <TextField label={label('immatriculation')} value={values.immatriculation} onChangeText={(v) => update('immatriculation', v)} error={message('immatriculation')} />
          <View onLayout={onSectionLayout('vin')}>
            <TextField label={label('vin')} value={values.vin} onChangeText={(v) => update('vin', v)} autoCapitalize="characters" optional />
          </View>
        </Section>

        <Section title={t('vehicleForm.sections.characteristics')}>
          <Labeled label={label('categorie')} onLayout={onSectionLayout('categorie')}>
            <ChipGroup options={VEHICLE_CATEGORIES} selected={values.categorie} getLabel={(c: VehicleCategory) => t(`vehicle.category.${c}`)} onSelect={(c) => update('categorie', c)} />
          </Labeled>
          <Labeled label={label('transmission')} onLayout={onSectionLayout('transmission')}>
            <ChipGroup options={VEHICLE_TRANSMISSIONS} selected={values.transmission} getLabel={(tr: VehicleTransmission) => t(`vehicle.transmission.${tr}`)} onSelect={(tr) => update('transmission', tr)} />
          </Labeled>
          <Labeled label={label('carburant')} onLayout={onSectionLayout('carburant')}>
            <ChipGroup options={FUEL_TYPES} selected={values.carburant} getLabel={(f) => t(`vehicle.fuel.${f}`)} onSelect={(f) => update('carburant', f)} />
          </Labeled>
          <View onLayout={onSectionLayout('nombrePlaces')}>
            <TextField label={label('nombrePlaces')} value={values.nombrePlaces} onChangeText={(v) => update('nombrePlaces', v.replace(/\D/g, ''))} keyboardType="number-pad" error={message('nombrePlaces')} />
          </View>
          <View onLayout={onSectionLayout('couleur')}>
            <TextField label={label('couleur')} value={values.couleur} onChangeText={(v) => update('couleur', v)} />
          </View>
          <View onLayout={onSectionLayout('annee')}>
            <TextField label={label('annee')} value={values.annee} onChangeText={(v) => update('annee', v.replace(/\D/g, ''))} keyboardType="number-pad" error={message('annee')} />
          </View>
          <TextField label={label('dateMiseEnCirculation')} value={values.dateMiseEnCirculation ?? ''} onChangeText={(v) => update('dateMiseEnCirculation', v)} placeholder={t('vehicle.fields.datePlaceholder')} error={message('dateMiseEnCirculation')} />
          <View onLayout={onSectionLayout('puissanceFiscale')}>
            <TextField label={label('puissanceFiscale')} value={values.puissanceFiscale ?? ''} onChangeText={(v) => update('puissanceFiscale', v.replace(/\D/g, ''))} keyboardType="number-pad" error={message('puissanceFiscale')} />
          </View>
        </Section>

        <Section title={t('vehicleForm.sections.usage')}>
          <View onLayout={onSectionLayout('kilometrage')}>
            <TextField label={label('kilometrage')} value={values.kilometrage} onChangeText={(v) => update('kilometrage', v.replace(/\D/g, ''))} keyboardType="number-pad" error={message('kilometrage')} />
          </View>
          <View onLayout={onSectionLayout('niveauCarburant')}>
            <TextField label={label('niveauCarburant')} value={values.niveauCarburant} onChangeText={(v) => update('niveauCarburant', clampPercentInput(v))} keyboardType="number-pad" placeholder={t('vehicle.fields.niveauCarburantPlaceholder')} error={message('niveauCarburant')} />
          </View>
        </Section>

        {showPrices ? (
          <Section title={t('vehicle.sections.tarification')} note={t('vehicleForm.pricingNote')}>
            <TextField label={label('prixJour')} value={values.prixJour} onChangeText={(v) => update('prixJour', v.replace(/\D/g, ''))} keyboardType="number-pad" error={message('prixJour')} />
            <TextField label={label('prixSemaine')} value={values.prixSemaine} onChangeText={(v) => update('prixSemaine', v.replace(/\D/g, ''))} keyboardType="number-pad" optional error={message('prixSemaine')} />
            <TextField label={label('prixMois')} value={values.prixMois} onChangeText={(v) => update('prixMois', v.replace(/\D/g, ''))} keyboardType="number-pad" optional error={message('prixMois')} />
          </Section>
        ) : null}

        <Section title={t('vehicleForm.sections.availability')}>
          <Labeled label={label('statut')}>
            {statusLocked ? (
              <View className="rounded-2xl border border-dashed border-border bg-surface px-4 py-3">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.statusLockedHint', { status: t(`flotte.status.${values.statut}`) })}
                </ThemedText>
              </View>
            ) : (
              <ChipGroup options={MANUAL_VEHICLE_STATUSES} selected={values.statut} getLabel={(s: VehicleStatus) => t(`flotte.status.${s}`)} onSelect={(s) => update('statut', s)} />
            )}
          </Labeled>
          {canChooseBranch ? (
            <Labeled label={label('branch')}>
              <View className="flex-row flex-wrap gap-2">
                {[{ id: null as string | null, nom: t('vehicle.fields.allBranches') }, ...branches.map((branch) => ({ id: branch.id as string | null, nom: branch.nom }))].map((option) => {
                  const selected = branchId === option.id;
                  return (
                    <Pressable key={option.id ?? 'all'} onPress={() => setBranchId(option.id)} accessibilityRole="button" accessibilityState={{ selected }} className={`rounded-full border px-4 py-2 ${selected ? 'border-graphite bg-graphite' : 'border-border bg-card'}`}>
                      <ThemedText type="small" style={{ color: selected ? Brand.white : Palette.textPrimary }}>
                        {option.nom}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </Labeled>
          ) : null}
        </Section>

        <Section title={t('vehicleForm.sections.description')}>
          <TextField value={values.description} onChangeText={(v) => update('description', v)} multiline numberOfLines={3} className="min-h-20" accessibilityLabel={label('description')} />
        </Section>

        {vehicleId ? (
          <Section title={t('vehicleForm.sections.media')} note={t('vehicleForm.mediaHint')}>
            <View className="flex-row gap-2">
              <Pressable onPress={() => router.push({ pathname: '/flotte/[id]/photos', params: { id: vehicleId } })} accessibilityRole="button" className="min-h-12 flex-1 items-center justify-center rounded-2xl border border-border bg-card px-3 py-3">
                <ThemedText type="small">{t('vehicleForm.openPhotos')}</ThemedText>
              </Pressable>
              <Pressable onPress={() => router.push({ pathname: '/flotte/[id]', params: { id: vehicleId, edit: 'documents' } })} accessibilityRole="button" className="min-h-12 flex-1 items-center justify-center rounded-2xl border border-border bg-card px-3 py-3">
                <ThemedText type="small">{t('vehicleForm.openDocuments')}</ThemedText>
              </Pressable>
            </View>
          </Section>
        ) : null}
      </ScrollView>

      <View className="gap-2 border-t border-border bg-background px-6 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {dirty ? t('vehicleForm.dirty') : t('vehicleForm.clean')}
        </ThemedText>
        <View className="flex-row gap-3">
          <Pressable onPress={() => router.back()} disabled={isSubmitting} accessibilityRole="button" accessibilityLabel={t('vehicleForm.cancel')} className="min-h-12 flex-1 items-center justify-center rounded-full border border-border">
            <ThemedText type="smallBold">{t('vehicleForm.cancel')}</ThemedText>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting || !dirty}
            accessibilityRole="button"
            accessibilityLabel={isSubmitting ? submittingLabel : submitLabel}
            accessibilityState={{ disabled: isSubmitting || !dirty, busy: isSubmitting }}
            className="min-h-12 flex-[1.5] items-center justify-center rounded-full bg-primary"
            style={{ opacity: isSubmitting || !dirty ? 0.5 : 1 }}
          >
            <ThemedText type="smallBold" style={{ color: Brand.white }}>
              {isSubmitting ? submittingLabel : submitLabel}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
