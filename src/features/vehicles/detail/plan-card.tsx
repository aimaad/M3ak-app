import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, DateField, FormField, TimeField } from '@/components/form';
import { Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { maintenanceLabel } from '@/features/maintenance/label';
import { useCheckMaintenanceConflicts, usePlanMaintenance } from '@/features/maintenance/hooks';
import type { MaintenanceConflict, MaintenanceItem, PlanInput } from '@/features/maintenance/types';
import { useLanguage } from '@/i18n/use-language';

import { customerShortName } from '../fleet-card';
import { describeSaveError } from '../save-error';
import { draftFromPlanned, emptyPlanDraft, planToInput, validatePlan, type PlanDraft } from './plan';

type PlanItem = Pick<MaintenanceItem, 'id' | 'vehicleId' | 'type' | 'titre' | 'plannedAt' | 'plannedMinutes' | 'plannedGarage'>;

const dayText = (iso: string, language: string) => new Date(iso).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short' });

/**
 * « Planifier » : date et heure du rendez-vous (obligatoires), durée estimée et garage (facultatifs). Les locations et réservations qui
 * chevauchent le créneau sont vérifiées : avertissement, avec « Choisir un autre créneau » ou « Poursuivre et signaler au responsable ».
 * Jamais bloquant. Le véhicule reste disponible jusqu'au début réel de l'immobilisation.
 */
export function PlanCard({ item, now, onClose }: { item: PlanItem; now: Date; onClose: () => void }) {
  const { t, language } = useLanguage();
  const plan = usePlanMaintenance();
  const check = useCheckMaintenanceConflicts();
  const [draft, setDraft] = useState<PlanDraft>(() => (item.plannedAt ? draftFromPlanned(item.plannedAt, item.plannedMinutes, item.plannedGarage) : emptyPlanDraft()));
  const [showErrors, setShowErrors] = useState(false);
  const [conflicts, setConflicts] = useState<MaintenanceConflict[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errors = validatePlan(draft, now);
  const message = (field: 'date' | 'time' | 'hours' | 'garage') => (errors[field] ? t(`vehicleDetail.plan.err.${errors[field]}`) : undefined);
  const busy = plan.isPending || check.isPending;
  const planned = !!item.plannedAt;

  function save(input: PlanInput, proceed: boolean) {
    setError(null);
    plan.mutate(
      { id: item.id, input, proceed },
      {
        onSuccess: onClose,
        onError: (failure) => {
          // Un conflit apparu entre-temps : on le montre au lieu d'échouer.
          if (typeof failure === 'object' && failure !== null && String((failure as { message?: unknown }).message).includes('maintenance_conflict') && input.at) {
            check.mutateAsync({ vehicleId: item.vehicleId, at: input.at, minutes: input.minutes }).then(setConflicts).catch(() => undefined);
            return;
          }
          setError(describeSaveError(failure, t, 'vehicleDetail.plan.failed'));
        },
      }
    );
  }

  async function confirm() {
    setShowErrors(true);
    setError(null);
    if (Object.keys(errors).length > 0) return;
    const input = planToInput(draft);
    try {
      const found = await check.mutateAsync({ vehicleId: item.vehicleId, at: input.at as string, minutes: input.minutes });
      if (found.length > 0) {
        setConflicts(found);
        return;
      }
    } catch (failure) {
      setError(describeSaveError(failure, t, 'vehicleDetail.plan.failed'));
      return;
    }
    save(input, false);
  }

  function cancelAppointment() {
    save({ at: null, minutes: null, garage: null }, false);
  }

  if (conflicts) {
    return (
      <View style={{ gap: 14, padding: 14, marginBottom: 12, borderRadius: 18, backgroundColor: Palette.surface }}>
        <View accessibilityRole="alert" style={{ gap: 8, borderRadius: 14, borderWidth: 1.5, borderColor: Palette.warning, backgroundColor: Palette.warningSoft, padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="warning-outline" size={18} color={Palette.warning} />
            <HText weight="bold" size={14} color={Palette.warning}>
              {t('vehicleDetail.plan.conflictTitle')}
            </HText>
          </View>
          {conflicts.map((conflict) => (
            <HText key={conflict.rentalId} size={13}>
              {t('vehicleDetail.plan.conflictLine', { customer: customerShortName(conflict.customer) ?? conflict.customer, from: dayText(conflict.start, language), to: dayText(conflict.end, language) })}
            </HText>
          ))}
          <HText size={12} color={Palette.textSecondary}>
            {t('vehicleDetail.plan.conflictHint')}
          </HText>
        </View>
        {error ? (
          <HText size={13} weight="semibold" color={Palette.error} accessibilityRole="alert">
            {error}
          </HText>
        ) : null}
        <Button label={t('vehicleDetail.plan.proceed')} loading={plan.isPending} onPress={() => save(planToInput(draft), true)} accessibilityLabel={t('vehicleDetail.plan.proceed')} />
        <Button variant="secondary" label={t('vehicleDetail.plan.another')} onPress={() => setConflicts(null)} disabled={plan.isPending} />
      </View>
    );
  }

  return (
    <View style={{ gap: 14, padding: 14, marginBottom: 12, borderRadius: 18, backgroundColor: Palette.surface }}>
      <HText font="display" weight="bold" size={16} accessibilityRole="header">
        {t('vehicleDetail.plan.title', { label: maintenanceLabel(item, t) })}
      </HText>
      <DateField label={t('vehicleDetail.plan.date')} value={draft.date || null} onChange={(iso) => setDraft({ ...draft, date: iso })} minimumDate={now} error={message('date')} showError={showErrors} />
      <TimeField label={t('vehicleDetail.plan.time')} value={draft.time || null} onChange={(time) => setDraft({ ...draft, time })} error={message('time')} showError={showErrors} />
      <FormField label={t('vehicleDetail.plan.duration')} value={draft.hours} onChangeText={(value) => setDraft({ ...draft, hours: value.replace(/[^\d.,]/g, '').slice(0, 5) })} keyboardType="decimal-pad" unit={t('vehicleDetail.plan.hoursUnit')} placeholder={t('vehicleDetail.plan.durationPlaceholder')} help={t('vehicleDetail.plan.durationHelp')} error={message('hours')} showError={showErrors} />
      <FormField label={t('vehicleDetail.plan.garage')} value={draft.garage} onChangeText={(value) => setDraft({ ...draft, garage: value })} placeholder={t('vehicleDetail.plan.garagePlaceholder')} autoCapitalize="words" error={message('garage')} showError={showErrors} />
      <HText size={12} color={Palette.textSecondary}>
        {t('vehicleDetail.plan.hint')}
      </HText>
      {error ? (
        <HText size={13} weight="semibold" color={Palette.error} accessibilityRole="alert">
          {error}
        </HText>
      ) : null}
      <Button label={t(planned ? 'vehicleDetail.plan.update' : 'vehicleDetail.plan.confirm')} loadingLabel={t('vehicleDetail.editor.saving')} loading={busy} onPress={() => void confirm()} accessibilityLabel={t(planned ? 'vehicleDetail.plan.update' : 'vehicleDetail.plan.confirm')} />
      <Button variant="secondary" label={t('vehicleDetail.editor.cancel')} onPress={onClose} disabled={busy} />
      {planned ? <Button variant="link" label={t('vehicleDetail.plan.cancelAppointment')} onPress={cancelAppointment} disabled={busy} /> : null}
    </View>
  );
}
