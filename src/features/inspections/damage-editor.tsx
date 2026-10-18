import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { ChipGroup } from '@/components/chip-group';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { DAMAGE_SEVERITIES, DAMAGE_TYPES, DAMAGE_ZONES, type DamageSeverity, type DamageType, type DamageZone } from './damages';

export type DamageDraft = {
  zone: DamageZone;
  type: DamageType;
  gravite: DamageSeverity;
  nouveau: boolean;
  cost: string;
  description: string;
};

/** Montant saisi (« 850 », « 850,5 ») → nombre ≥ 0 arrondi au dirham, ou null si vide / invalide. */
export function parseCost(raw: string): number | null {
  const value = Number(raw.trim().replace(/\s/g, '').replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 1_000_000 ? Math.round(value) : null;
}

type Props = {
  initial: DamageDraft;
  /** Au retour seulement : l'employé peut dire si le dommage est nouveau ou déjà présent au départ. */
  canChooseNew: boolean;
  saving?: boolean;
  error?: string | null;
  saveLabel?: string;
  onSave: (draft: DamageDraft) => void;
  onCancel: () => void;
};

/** Correction (ou ajout) d'un dommage : emplacement, type, gravité, coût et description. L'employé a le dernier mot. */
export function DamageEditor({ initial, canChooseNew, saving, error, saveLabel, onSave, onCancel }: Props) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<DamageDraft>(initial);
  const costInvalid = draft.cost.trim() !== '' && parseCost(draft.cost) === null;

  return (
    <View className="gap-3 border-t border-[#EAE5F2] pt-3">
      <View className="gap-1.5">
        <ThemedText type="small" themeColor="textSecondary">
          {t('inspection.analysis.damages.zone')}
        </ThemedText>
        <ChipGroup<DamageZone>
          options={[...DAMAGE_ZONES]}
          selected={draft.zone}
          getLabel={(zone) => t(`inspection.analysis.zonesLabel.${zone}`)}
          onSelect={(zone) => setDraft((prev) => ({ ...prev, zone }))}
        />
      </View>
      <View className="gap-1.5">
        <ThemedText type="small" themeColor="textSecondary">
          {t('inspection.analysis.damages.type')}
        </ThemedText>
        <ChipGroup<DamageType>
          options={[...DAMAGE_TYPES]}
          selected={draft.type}
          getLabel={(type) => t(`inspection.analysis.types.${type}`)}
          onSelect={(type) => setDraft((prev) => ({ ...prev, type }))}
        />
      </View>
      <View className="gap-1.5">
        <ThemedText type="small" themeColor="textSecondary">
          {t('inspection.analysis.damages.severity')}
        </ThemedText>
        <ChipGroup<DamageSeverity>
          options={DAMAGE_SEVERITIES}
          selected={draft.gravite}
          getLabel={(severity) => t(`inspection.analysis.damages.severity.${severity}`)}
          onSelect={(gravite) => setDraft((prev) => ({ ...prev, gravite }))}
        />
      </View>
      {canChooseNew ? (
        <Pressable onPress={() => setDraft((prev) => ({ ...prev, nouveau: !prev.nouveau }))} className="flex-row items-center gap-2" accessibilityRole="switch" accessibilityState={{ checked: draft.nouveau }}>
          <View className="h-6 w-6 items-center justify-center rounded-md border" style={{ borderColor: M3akPalette.mauve, backgroundColor: draft.nouveau ? M3akPalette.mauve : '#fff' }}>
            {draft.nouveau ? <ThemedText type="smallBold" style={{ color: '#fff' }}>✓</ThemedText> : null}
          </View>
          <ThemedText type="small">{t('inspection.analysis.damages.isNew')}</ThemedText>
        </Pressable>
      ) : null}
      <TextField
        label={t('inspection.analysis.damages.cost')}
        value={draft.cost}
        onChangeText={(cost) => setDraft((prev) => ({ ...prev, cost }))}
        keyboardType="numeric"
        error={costInvalid ? t('vehicle.form.errors.invalid_number') : undefined}
      />
      <TextField
        label={t('inspection.analysis.damages.descriptionLabel')}
        value={draft.description}
        onChangeText={(description) => setDraft((prev) => ({ ...prev, description }))}
        placeholder={t('inspection.analysis.damages.descriptionPlaceholder')}
        multiline
        maxLength={300}
      />
      {error ? (
        <ThemedText type="small" style={{ color: M3akPalette.danger }}>
          {error}
        </ThemedText>
      ) : null}
      <View className="flex-row gap-2">
        <Button label={t('inspection.analysis.damages.cancel')} variant="secondary" size="sm" style={{ flex: 1 }} onPress={onCancel} />
        <Button
          label={saveLabel ?? t('inspection.analysis.damages.save')}
          size="sm"
          style={{ flex: 1 }}
          loading={saving}
          disabled={costInvalid}
          onPress={() => onSave(draft)}
        />
      </View>
    </View>
  );
}
