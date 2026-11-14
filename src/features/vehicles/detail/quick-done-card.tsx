import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, DateField, FormField } from '@/components/form';
import { Brand, Palette } from '@/constants/theme';
import { formatAmount, HText } from '@/features/dashboard/home-ui';
import { useQuickCompleteMaintenance } from '@/features/maintenance/hooks';
import type { MaintenanceItem } from '@/features/maintenance/types';
import { useLanguage } from '@/i18n/use-language';

import { describeSaveError } from '../save-error';
import type { Vehicle } from '../types';
import { quickDoneDraft, quickDoneInput, validateQuickDone, type QuickDoneDraft } from './quick-done';

/**
 * « ✓ Fait » en un geste : kilométrage de la fiche et date du jour déjà remplis, on confirme. Garage et coût (propriétaire et responsable)
 * sont facultatifs, sous « Ajouter des détails ». La suivante se crée toute seule si l'échéance est périodique.
 */
export function QuickDoneCard({ item, vehicle, now, showCost, onClose }: { item: Pick<MaintenanceItem, 'id' | 'type'>; vehicle: Vehicle; now: Date; showCost: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const done = useQuickCompleteMaintenance();
  const [draft, setDraft] = useState<QuickDoneDraft>(() => quickDoneDraft(vehicle, now));
  const [details, setDetails] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = validateQuickDone(draft, vehicle, now);
  const message = (field: 'km' | 'date' | 'cout') => (errors[field] ? t(`vehicleDetail.quick.err.${errors[field]}`, { km: formatAmount(vehicle.kilometrage) }) : undefined);

  function confirm() {
    setShowErrors(true);
    setError(null);
    if (Object.keys(errors).length > 0 || !item.id) return;
    done.mutate({ id: item.id, input: quickDoneInput(draft, showCost) }, { onSuccess: onClose, onError: (failure) => setError(describeSaveError(failure, t, 'vehicleDetail.quick.failed')) });
  }

  return (
    <View style={{ gap: 14, padding: 14, marginBottom: 12, borderRadius: 18, backgroundColor: Palette.surface }}>
      <HText font="display" weight="bold" size={16} accessibilityRole="header">
        {t('vehicleDetail.quick.title', { label: t(`maintenance.types.${item.type}`) })}
      </HText>
      <FormField label={t('vehicleDetail.quick.km')} value={draft.km} onChangeText={(value) => setDraft({ ...draft, km: value.replace(/\D/g, '') })} thousands unit={t('flotte.km')} placeholder={t('vehicleForm.edit.ph.kilometrage')} error={message('km')} showError={showErrors} />
      <DateField label={t('vehicleDetail.quick.date')} value={draft.date} onChange={(iso) => setDraft({ ...draft, date: iso })} maximumDate={now} error={message('date')} showError={showErrors} />
      {details ? (
        <View style={{ gap: 14 }}>
          <FormField label={t('maintenance.fields.garage')} value={draft.garage} onChangeText={(value) => setDraft({ ...draft, garage: value })} placeholder={t('vehicleDetail.quick.garagePlaceholder')} autoCapitalize="words" />
          {showCost ? <FormField label={t('maintenance.fields.cout')} value={draft.cout} onChangeText={(value) => setDraft({ ...draft, cout: value.replace(/[^\d.,]/g, '') })} keyboardType="decimal-pad" unit="MAD" placeholder={t('vehicleDetail.quick.costPlaceholder')} error={message('cout')} showError={showErrors} /> : null}
        </View>
      ) : (
        <Pressable onPress={() => setDetails(true)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <HText weight="semibold" size={13} color={Brand.orangeUrgentText}>
            {t('vehicleDetail.quick.moreDetails')}
          </HText>
        </Pressable>
      )}
      <HText size={12} color={Palette.textSecondary}>
        {t('vehicleDetail.quick.hint')}
      </HText>
      <View style={{ gap: 10 }}>
        {error ? (
          <HText size={13} weight="semibold" color={Palette.error} accessibilityRole="alert">
            {error}
          </HText>
        ) : null}
        <Button label={t('vehicleDetail.quick.confirm')} loadingLabel={t('vehicleDetail.editor.saving')} loading={done.isPending} onPress={confirm} accessibilityLabel={t('vehicleDetail.quick.confirm')} />
        <Button variant="secondary" label={t('vehicleDetail.editor.cancel')} onPress={onClose} disabled={done.isPending} />
      </View>
    </View>
  );
}
