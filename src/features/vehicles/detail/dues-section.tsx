import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { formatAmount, HText } from '@/features/dashboard/home-ui';
import { useCreateMaintenanceItem, useDeleteMaintenanceItem, useUpdateMaintenanceDue } from '@/features/maintenance/hooks';
import type { MaintenanceType } from '@/features/maintenance/types';
import { useLanguage } from '@/i18n/use-language';

import { useUpdateVehicleDocuments } from '../hooks';
import type { Vehicle } from '../types';
import { fromIsoDate } from '../validation';
import { ComplianceBlock } from './compliance-block';
import { Chips, Field, FieldGroup, FormActions } from './form-ui';
import { ADDABLE_DUE_TYPES, draftOf, dueSuggestion, emptyDraft, planDueSave, validateDue, type DueDraft } from './dues-edit';
import type { DueRow } from './dues';

const CARD = { backgroundColor: Brand.white, borderWidth: 1, borderColor: Palette.border, borderRadius: 24, padding: 16, gap: 4 } as const;
const DUE_ICON: Record<DueRow['icon'], keyof typeof Ionicons.glyphMap> = { shield: 'shield-checkmark-outline', calendar: 'calendar-outline', wrench: 'construct-outline' };
const shortDate = (iso: string, language: string) => new Date(iso).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short' });

/** Pastille de suggestion (« Dans 12 mois : … », « À 70 000 km ») : un toucher remplit le champ. */
function Suggestion({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ alignSelf: 'flex-start', minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: Palette.border, backgroundColor: Brand.white, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name="sparkles-outline" size={13} color={Palette.textSecondary} />
      <HText size={12} weight="semibold" color={Palette.textSecondary}>
        {text}
      </HText>
    </Pressable>
  );
}

/** Champs d'une échéance (date, kilométrage, notes) avec les suggestions d'usage ; sert à modifier une ligne et à en ajouter une. */
function DueFields({ type, vehicle, draft, setDraft, showErrors, now }: { type: MaintenanceType; vehicle: Vehicle; draft: DueDraft; setDraft: (draft: DueDraft) => void; showErrors: boolean; now: Date }) {
  const { t } = useLanguage();
  const errors = validateDue(draft);
  const suggestion = dueSuggestion(type, vehicle, now);
  const message = (field: 'date' | 'km') => {
    const code = showErrors ? errors[field] : undefined;
    return code ? (code === 'need_one' ? t('vehicleDetail.dues.edit.needOne') : t(`vehicle.form.errors.${code}`)) : undefined;
  };
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Field label={t('vehicleDetail.dues.edit.dateLabel')} placeholder={t('vehicleDetail.dues.edit.dateHint')} value={draft.date} onChangeText={(value) => setDraft({ ...draft, date: value })} error={message('date')} />
        {suggestion.date ? <Suggestion text={t('vehicleDetail.dues.edit.suggestDate', { date: fromIsoDate(suggestion.date) })} onPress={() => setDraft({ ...draft, date: fromIsoDate(suggestion.date) })} /> : null}
      </View>
      <View style={{ gap: 8 }}>
        <Field label={t('vehicleDetail.dues.edit.kmLabel')} value={draft.km} onChangeText={(value) => setDraft({ ...draft, km: value.replace(/\D/g, '') })} keyboardType="number-pad" unit={t('flotte.km')} hint={t('vehicleDetail.dues.edit.kmCurrent', { km: formatAmount(vehicle.kilometrage) })} error={message('km')} />
        {suggestion.km !== null ? <Suggestion text={t('vehicleDetail.dues.edit.suggestKm', { km: formatAmount(suggestion.km) })} onPress={() => setDraft({ ...draft, km: String(suggestion.km) })} /> : null}
      </View>
      <Field label={t('vehicleDetail.dues.edit.notesLabel')} value={draft.notes} onChangeText={(value) => setDraft({ ...draft, notes: value })} multiline />
    </View>
  );
}

/** Ajout d'une échéance : type, date, kilométrage, notes — dans la carte, sans changer de page. */
function AddDue({ vehicle, now, onClose }: { vehicle: Vehicle; now: Date; onClose: () => void }) {
  const { t } = useLanguage();
  const agency = useMyAgency();
  const create = useCreateMaintenanceItem();
  const [type, setType] = useState<MaintenanceType>('vidange');
  const [draft, setDraft] = useState<DueDraft>(emptyDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = planDueSave({ type }, { documents: [] }, draft);

  function save() {
    setShowErrors(true);
    setError(null);
    if (Object.keys(validateDue(draft)).length > 0 || !agency.data || !plan.createItem) return;
    create.mutate(
      { agencyId: agency.data.agencyId, input: { vehicleId: vehicle.id, ...plan.createItem } },
      { onSuccess: onClose, onError: () => setError(t('vehicleDetail.dues.edit.saveError')) }
    );
  }

  return (
    <View style={{ gap: 16, padding: 14, marginVertical: 10, borderRadius: 18, backgroundColor: Palette.surface }}>
      <HText font="display" weight="bold" size={16} accessibilityRole="header">
        {t('vehicleDetail.dues.edit.addTitle')}
      </HText>
      <FieldGroup label={t('vehicleDetail.dues.edit.type')}>
        <Chips options={ADDABLE_DUE_TYPES} selected={type} getLabel={(value) => t(`maintenance.types.${value}`)} onSelect={setType} />
      </FieldGroup>
      <DueFields type={type} vehicle={vehicle} draft={draft} setDraft={setDraft} showErrors={showErrors} now={now} />
      <FormActions onSave={save} onCancel={onClose} busy={create.isPending} error={error} />
    </View>
  );
}

/** Une ligne d'échéance dépliée : correction de la date et du kilométrage, « Marquer comme fait » (écran d'entretien), « Supprimer ». */
function EditDue({ row, vehicle, now, canDelete, onClose }: { row: DueRow; vehicle: Vehicle; now: Date; canDelete: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const agency = useMyAgency();
  const create = useCreateMaintenanceItem();
  const update = useUpdateMaintenanceDue();
  const remove = useDeleteMaintenanceItem();
  const updateDocuments = useUpdateVehicleDocuments();
  const [draft, setDraft] = useState<DueDraft>(() => draftOf(row));
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setShowErrors(true);
    setError(null);
    if (Object.keys(validateDue(draft)).length > 0) return;
    const plan = planDueSave(row, vehicle, draft);
    setBusy(true);
    try {
      if (plan.updateItem) await update.mutateAsync({ id: plan.updateItem.id, patch: { echeanceDate: plan.updateItem.echeanceDate, echeanceKm: plan.updateItem.echeanceKm, notes: plan.updateItem.notes } });
      if (plan.createItem && agency.data) await create.mutateAsync({ agencyId: agency.data.agencyId, input: { vehicleId: vehicle.id, ...plan.createItem } });
      if (plan.syncDocumentExpiry) {
        const { type, expiresAt } = plan.syncDocumentExpiry;
        await updateDocuments.mutateAsync({ id: vehicle.id, documents: vehicle.documents.map((doc) => (doc.type === type ? { ...doc, expiresAt } : doc)) });
      }
      onClose();
    } catch {
      setError(t('vehicleDetail.dues.edit.saveError'));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!row.maintenanceId) return;
    const id = row.maintenanceId;
    Alert.alert(t('vehicleDetail.dues.edit.deleteTitle'), t('vehicleDetail.dues.edit.deleteBody'), [
      { text: t('vehicleDetail.editor.cancel'), style: 'cancel' },
      {
        text: t('vehicleDetail.dues.edit.delete'),
        style: 'destructive',
        onPress: () => remove.mutate({ id, vehicleId: vehicle.id }, { onSuccess: onClose, onError: () => setError(t('vehicleDetail.dues.edit.deleteError')) }),
      },
    ]);
  }

  const link = { minHeight: 44, justifyContent: 'center' } as const;
  return (
    <View style={{ gap: 16, padding: 14, marginBottom: 12, borderRadius: 18, backgroundColor: Palette.surface }}>
      <DueFields type={row.type} vehicle={vehicle} draft={draft} setDraft={setDraft} showErrors={showErrors} now={now} />
      <FormActions onSave={() => void save()} onCancel={onClose} busy={busy} error={error} />
      {row.maintenanceId ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.push({ pathname: '/maintenance/[id]', params: { id: row.maintenanceId as string } })} accessibilityRole="button" style={link}>
            <HText weight="semibold" size={13} color={Brand.orangeUrgentText}>
              {t('vehicleDetail.dues.edit.markDone')}
            </HText>
          </Pressable>
          {canDelete ? (
            <Pressable onPress={confirmDelete} accessibilityRole="button" style={link}>
              <HText weight="semibold" size={13} color={Palette.error}>
                {t('vehicleDetail.dues.edit.delete')}
              </HText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Échéances complètes, modifiables SUR PLACE : une ligne par échéance (assurance, visite technique, entretiens) ; un toucher la déplie
 * pour corriger la date et le kilométrage ; « + Ajouter » ouvre le formulaire dans la carte.
 */
export function DuesSection({ vehicle, rows: allRows, now }: { vehicle: Vehicle; rows: DueRow[]; now: Date }) {
  // L'assurance et la visite technique sont dans « Obligations légales » (ComplianceBlock) : ici, seulement les entretiens.
  const rows = allRows.filter((row) => row.type !== 'assurance' && row.type !== 'visite_technique');
  const { t, language } = useLanguage();
  const agency = useMyAgency();
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const canDelete = agency.data?.role === 'owner' || agency.data?.role === 'manager';
  const dueText = (row: DueRow) => {
    switch (row.due.kind) {
      case 'days':
        return row.due.days === 0 ? t('vehicleDetail.dues.today') : t('vehicleDetail.dues.daysLeft', { n: row.due.days });
      case 'km':
        return t('vehicleDetail.dues.kmLeft', { km: formatAmount(row.due.km) });
      case 'expired':
        return t('vehicleDetail.dues.expired');
      default:
        return t('vehicleDetail.dues.none');
    }
  };
  const subText = (row: DueRow) => {
    if (row.missingFile) return t('vehicleDetail.dues.addPhoto');
    if (row.date) return t(row.urgency === 'expired' ? 'vehicleDetail.dues.subDateOverdue' : 'vehicleDetail.dues.subDate', { date: shortDate(row.date, language) });
    if (row.targetKm !== null) return t(row.urgency === 'expired' ? 'vehicleDetail.dues.subKmOverdue' : 'vehicleDetail.dues.subKm', { km: formatAmount(row.targetKm) });
    return t('vehicleDetail.dues.subNoDate');
  };

  return (
    <View style={CARD}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
        <HText font="display" weight="bold" size={17} accessibilityRole="header">
          {t('vehicleDetail.dues.title')}
        </HText>
        <Pressable onPress={() => setOpen(open === 'new' ? null : 'new')} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.dues.add')} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
          <HText weight="semibold" size={12} color={Brand.orangeUrgentText}>
            {t('vehicleDetail.dues.add')}
          </HText>
        </Pressable>
      </View>

      <ComplianceBlock vehicle={vehicle} now={now} />

      <HText weight="semibold" size={11} track={0.14} color={Palette.textSecondary} style={{ marginTop: 12, marginBottom: 2 }}>
        {t('vehicleDetail.compliance.maintenance').toLocaleUpperCase()}
      </HText>

      {open === 'new' ? <AddDue vehicle={vehicle} now={now} onClose={() => setOpen(null)} /> : null}

      {rows.length === 0 && open !== 'new' ? (
        <HText size={13} color={Palette.textSecondary}>
          {t('vehicleDetail.dues.edit.empty')}
        </HText>
      ) : null}

      {rows.map((row) => {
        const hot = row.urgency === 'hot' || row.urgency === 'expired';
        const label = t(`maintenance.types.${row.type}`);
        const due = dueText(row);
        const sub = subText(row);
        const expanded = open === row.key;
        return (
          <View key={row.key} style={{ borderTopWidth: 1, borderTopColor: Brand.gaugeTrack }}>
            <Pressable
              onPress={() => setOpen(expanded ? null : row.key)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={t('vehicleDetail.dues.a11y', { label, due, sub })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 56 }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hot ? Palette.primary : Palette.surfaceAlt }}>
                <Ionicons name={DUE_ICON[row.icon]} size={18} color={hot ? Brand.white : Brand.graphite} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <HText weight="semibold" size={14}>
                    {label}
                  </HText>
                  <HText font="display" weight="bold" size={14} color={hot ? Brand.orangeUrgentText : Palette.textPrimary}>
                    {due}
                  </HText>
                </View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: Brand.gaugeTrack, overflow: 'hidden', flexDirection: 'row' }}>
                  <View style={{ width: `${Math.round(row.fill * 100)}%`, borderRadius: 3, backgroundColor: hot ? Palette.primary : Brand.graphite }} />
                </View>
                <HText size={11} color={row.missingFile ? Brand.orangeUrgentText : Palette.textSecondary} weight={row.missingFile ? 'semibold' : 'regular'}>
                  {sub}
                </HText>
              </View>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Palette.textSecondary} />
            </Pressable>
            {expanded ? <EditDue row={row} vehicle={vehicle} now={now} canDelete={canDelete} onClose={() => setOpen(null)} /> : null}
          </View>
        );
      })}
    </View>
  );
}
