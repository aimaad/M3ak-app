import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button, ChoiceTiles, DangerLink, DateField, FormField, Segmented, TileIconView, type TileIcon } from '@/components/form';
import { DUE_TYPE_IMAGE } from '@/constants/due-icons';
import { Brand, Palette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { formatAmount, HText } from '@/features/dashboard/home-ui';
import { useCreateMaintenanceItem, useDeleteMaintenanceItem, useUpdateMaintenanceDue, useVehicleMaintenanceItems } from '@/features/maintenance/hooks';
import type { ComplianceKind } from '@/features/compliance/types';
import type { MaintenanceType } from '@/features/maintenance/types';
import { useLanguage } from '@/i18n/use-language';

import { useUpdateVehicleDocuments } from '../hooks';
import { describeSaveError } from '../save-error';
import type { Vehicle } from '../types';
import { fromIsoDate, toIsoDate } from '../validation';
import { ComplianceBlock } from './compliance-block';
import { ADDABLE_DUE_TYPES, draftOf, dueAlreadyPassed, effectiveDue, emptyDraft, planDueSave, REPEATABLE_TYPES, validateDue, type DueDraft } from './dues-edit';
import type { DueRow } from './dues';

const NO_ITEMS: never[] = [];
const CARD = { backgroundColor: Brand.white, borderWidth: 1, borderColor: Palette.border, borderRadius: 24, padding: 16, gap: 4 } as const;
const DUE_ICON: Record<DueRow['icon'], keyof typeof Ionicons.glyphMap> = { shield: 'shield-checkmark-outline', calendar: 'calendar-outline', wrench: 'construct-outline' };
const shortDate = (iso: string, language: string) => new Date(iso).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short' });


/** Un seul bouton orange par formulaire (Enregistrer), « Annuler » en secondaire, le message d'échec dessous. */
function DueActions({ onSave, onCancel, busy, error }: { onSave: () => void; onCancel: () => void; busy: boolean; error: string | null }) {
  const { t } = useLanguage();
  return (
    <View style={{ gap: 10 }}>
      {error ? (
        <HText size={13} weight="semibold" color={Palette.error} accessibilityRole="alert">
          {error}
        </HText>
      ) : null}
      <Button label={t('vehicleDetail.dues.edit.saveButton')} loadingLabel={t('vehicleDetail.editor.saving')} loading={busy} onPress={onSave} accessibilityLabel={t('vehicleDetail.dues.edit.saveButton')} />
      <Button variant="secondary" label={t('vehicleDetail.editor.cancel')} onPress={onCancel} disabled={busy} />
    </View>
  );
}

/**
 * Champs d'une échéance, dans l'ordre où on y pense : nom (pour « Autre »), « se répète » (km et/ou mois), « dernière fois faite » (pour que la
 * prochaine se calcule toute seule), « prochaine échéance » (date et/ou kilométrage : la première atteinte déclenche ; calculée si on ne la saisit pas),
 * note repliée. Tout part vide ; une échéance déjà dépassée est signalée sans rien bloquer.
 */
function DueFields({ type, vehicle, draft, setDraft, showErrors, now }: { type: MaintenanceType; vehicle: Vehicle; draft: DueDraft; setDraft: (draft: DueDraft) => void; showErrors: boolean; now: Date }) {
  const { t } = useLanguage();
  const [notesOpen, setNotesOpen] = useState(draft.notes.trim() !== '');
  const errors = validateDue(draft, type);
  const effective = effectiveDue(draft);
  const passed = dueAlreadyPassed(effective, vehicle.kilometrage, now);
  const message = (field: 'date' | 'km' | 'repeatKm' | 'repeatMonths' | 'repeat' | 'lastDate' | 'lastKm' | 'titre') => {
    const code = showErrors ? errors[field] : undefined;
    if (!code) return undefined;
    if (code === 'need_one') return t('vehicleDetail.dues.edit.needOne');
    if (code === 'need_one_repeat') return t('vehicleDetail.dues.edit.needOneRepeat');
    if (code === 'required') return t('vehicleDetail.dues.edit.titleRequired');
    return t(`vehicle.form.errors.${code}`);
  };
  const computedDate = effective.dateComputed && effective.date ? t('vehicleDetail.dues.edit.computed', { value: fromIsoDate(effective.date) }) : undefined;
  const computedKm = effective.kmComputed && effective.km !== null ? t('vehicleDetail.dues.edit.computed', { value: `${formatAmount(effective.km)} km` }) : undefined;
  const passedText = passed
    ? [passed.km !== null ? t('vehicleDetail.dues.edit.passedKm', { km: formatAmount(passed.km) }) : null, passed.days !== null ? t(passed.days === 1 ? 'vehicleDetail.dues.edit.passedDaysOne' : 'vehicleDetail.dues.edit.passedDays', { count: passed.days }) : null].filter(Boolean).join(' ')
    : null;
  return (
    <View style={{ gap: 16 }}>
      {type === 'autre' ? <FormField label={t('vehicleDetail.dues.edit.titleLabel')} value={draft.titre} onChangeText={(value) => setDraft({ ...draft, titre: value.slice(0, 80) })} placeholder={t('vehicleDetail.dues.edit.titlePlaceholder')} error={message('titre')} showError={showErrors} autoCapitalize="sentences" /> : null}

      {REPEATABLE_TYPES.includes(type) ? (
        <View style={{ gap: 12 }}>
          <Segmented<'once' | 'periodic'>
            label={t('vehicleDetail.dues.edit.repeatLabel')}
            value={draft.repeat ? 'periodic' : 'once'}
            onChange={(value) => setDraft(value === 'once' ? { ...draft, repeat: false, repeatKm: '', repeatMonths: '', lastDate: '', lastKm: '' } : { ...draft, repeat: true })}
            options={[
              { value: 'once', label: t('vehicleDetail.dues.edit.repeatOnce') },
              { value: 'periodic', label: t('vehicleDetail.dues.edit.repeatPeriodic') },
            ]}
          />
          {draft.repeat ? (
            <>
              <FormField label={t('vehicleDetail.dues.edit.repeatKmLabel')} value={draft.repeatKm} onChangeText={(value) => setDraft({ ...draft, repeatKm: value.replace(/\D/g, '') })} thousands unit={t('flotte.km')} placeholder={t('vehicleDetail.dues.edit.repeatKmPlaceholder')} error={message('repeatKm')} showError={showErrors} />
              <FormField label={t('vehicleDetail.dues.edit.repeatMonthsLabel')} value={draft.repeatMonths} onChangeText={(value) => setDraft({ ...draft, repeatMonths: value.replace(/\D/g, '').slice(0, 3) })} keyboardType="number-pad" unit={t('vehicleDetail.dues.edit.monthsUnit')} placeholder={t('vehicleDetail.dues.edit.repeatMonthsPlaceholder')} error={message('repeatMonths')} showError={showErrors} />
              <HText size={12} color={message('repeat') ? Palette.error : Palette.textSecondary} weight={message('repeat') ? 'semibold' : 'regular'}>
                {message('repeat') ?? t('vehicleDetail.dues.edit.repeatHelp')}
              </HText>
              <HText weight="semibold" size={13} color={Palette.textSecondary}>
                {t('vehicleDetail.dues.edit.lastTitle')}
              </HText>
              <DateField label={t('vehicleDetail.dues.edit.lastDate')} value={toIsoDate(draft.lastDate)} onChange={(iso) => setDraft({ ...draft, lastDate: fromIsoDate(iso) })} maximumDate={now} error={message('lastDate')} showError={showErrors} />
              <FormField label={t('vehicleDetail.dues.edit.lastKm')} value={draft.lastKm} onChangeText={(value) => setDraft({ ...draft, lastKm: value.replace(/\D/g, '') })} thousands unit={t('flotte.km')} placeholder={t('vehicleForm.edit.ph.kilometrage')} help={t('vehicleDetail.dues.edit.lastHint', { km: formatAmount(vehicle.kilometrage) })} error={message('lastKm')} showError={showErrors} />
            </>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <HText weight="semibold" size={13} color={Palette.textSecondary}>
          {t('vehicleDetail.dues.edit.nextTitle')}
        </HText>
        <DateField label={t('vehicleDetail.dues.edit.dateLabel')} value={toIsoDate(draft.date)} onChange={(iso) => setDraft({ ...draft, date: fromIsoDate(iso) })} help={computedDate} error={message('date')} showError={showErrors} />
        <FormField label={t('vehicleDetail.dues.edit.kmLabel')} value={draft.km} onChangeText={(value) => setDraft({ ...draft, km: value.replace(/\D/g, '') })} thousands unit={t('flotte.km')} placeholder={t('vehicleForm.edit.ph.kilometrage')} help={computedKm ?? t('vehicleDetail.dues.edit.kmCurrent', { km: formatAmount(vehicle.kilometrage) })} error={message('km')} showError={showErrors} />
        <HText size={12} color={Palette.textSecondary}>
          {t(draft.repeat ? 'vehicleDetail.dues.edit.autoHint' : 'vehicleDetail.dues.edit.firstHint')}
        </HText>
        {passedText ? (
          <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8, borderRadius: 14, borderWidth: 1.5, borderColor: Palette.warning, backgroundColor: Palette.warningSoft, padding: 12 }}>
            <Ionicons name="alert-circle-outline" size={16} color={Palette.warning} />
            <HText weight="semibold" size={13} color={Palette.warning} style={{ flex: 1 }}>
              {`${passedText} ${t('vehicleDetail.dues.edit.passedTail')}`}
            </HText>
          </View>
        ) : null}
      </View>

      {notesOpen ? (
        <FormField label={t('vehicleDetail.dues.edit.notesLabel')} value={draft.notes} onChangeText={(value) => setDraft({ ...draft, notes: value })} placeholder={t('vehicleDetail.dues.edit.notesPlaceholder')} multiline />
      ) : (
        <Pressable onPress={() => setNotesOpen(true)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <HText weight="semibold" size={13} color={Brand.orangeUrgentText}>
            {t('vehicleDetail.dues.edit.addNote')}
          </HText>
        </Pressable>
      )}
    </View>
  );
}

/** Un seul point d'entrée : les 4 entretiens ET les 3 obligations (assurance, visite technique, vignette). */
type AddType = MaintenanceType;

/** Ajout d'une échéance : on choisit le type (entretien ou obligation), puis les champs apparaissent — dans la carte, sans changer de page. */
function AddDue({ vehicle, now, onClose, onSaved }: { vehicle: Vehicle; now: Date; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const agency = useMyAgency();
  const create = useCreateMaintenanceItem();
  const [type, setType] = useState<AddType | null>(null);
  const [draft, setDraft] = useState<DueDraft>(emptyDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maintenanceType = type;
  const plan = planDueSave({ type: maintenanceType ?? 'autre' }, { documents: [] }, draft);

  function save() {
    setShowErrors(true);
    setError(null);
    if (!maintenanceType || Object.keys(validateDue(draft, maintenanceType)).length > 0 || !agency.data || !plan.createItem) return;
    create.mutate(
      { agencyId: agency.data.agencyId, input: { vehicleId: vehicle.id, ...plan.createItem } },
      { onSuccess: () => { onSaved(); onClose(); }, onError: (failure) => setError(describeSaveError(failure, t, 'vehicleDetail.dues.edit.saveError')) }
    );
  }

  const options = [
    // Assurance, visite technique et vignette sont déjà listées juste au-dessus (« À compléter » si absentes) : jamais proposées ici.
    ...ADDABLE_DUE_TYPES.map((value) => ({ value: value as AddType, label: t(`maintenance.types.${value}`), icon: (DUE_TYPE_IMAGE[value] ?? 'ellipse-outline') as TileIcon })),
  ];

  return (
    <View style={{ gap: 16, padding: 14, marginVertical: 10, borderRadius: 18, backgroundColor: Palette.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <HText font="display" weight="bold" size={16} accessibilityRole="header" style={{ flexShrink: 1 }}>
          {t('vehicleDetail.dues.edit.addTitle')}
        </HText>
        {/* « − » : replie le formulaire sans rien enregistrer. */}
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.dues.collapse')} hitSlop={8} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surfaceAlt }}>
          <Ionicons name="remove" size={22} color={Brand.graphite} />
        </Pressable>
      </View>
      <ChoiceTiles<AddType> label={t('vehicleDetail.dues.edit.type')} value={type} onChange={setType} options={options} />
      {maintenanceType ? (
        <>
          <DueFields type={maintenanceType} vehicle={vehicle} draft={draft} setDraft={setDraft} showErrors={showErrors} now={now} />
          <DueActions onSave={save} onCancel={onClose} busy={create.isPending} error={error} />
        </>
      ) : null}
    </View>
  );
}

/** Une ligne d'échéance dépliée : correction de la date et du kilométrage, « Marquer comme fait » (écran d'entretien), « Supprimer ». */
function EditDue({ row, vehicle, now, canDelete, onClose, onSaved }: { row: DueRow; vehicle: Vehicle; now: Date; canDelete: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const agency = useMyAgency();
  const create = useCreateMaintenanceItem();
  const update = useUpdateMaintenanceDue();
  const remove = useDeleteMaintenanceItem();
  const updateDocuments = useUpdateVehicleDocuments();
  const items = useVehicleMaintenanceItems(vehicle.id).data ?? NO_ITEMS;
  const [draft, setDraft] = useState<DueDraft>(() => {
    const item = items.find((entry) => entry.id === row.maintenanceId);
    const repeatKm = item?.repeatKm != null ? String(item.repeatKm) : '';
    const repeatMonths = item?.repeatMonths != null ? String(item.repeatMonths) : '';
    return { ...draftOf(row), titre: item?.titre ?? '', repeat: repeatKm !== '' || repeatMonths !== '', repeatKm, repeatMonths };
  });
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setShowErrors(true);
    setError(null);
    if (Object.keys(validateDue(draft, row.type)).length > 0) return;
    const plan = planDueSave(row, vehicle, draft);
    setBusy(true);
    try {
      if (plan.updateItem) await update.mutateAsync({ id: plan.updateItem.id, patch: { echeanceDate: plan.updateItem.echeanceDate, echeanceKm: plan.updateItem.echeanceKm, notes: plan.updateItem.notes, titre: plan.updateItem.titre, repeatKm: plan.updateItem.repeatKm, repeatMonths: plan.updateItem.repeatMonths } });
      if (plan.createItem && agency.data) await create.mutateAsync({ agencyId: agency.data.agencyId, input: { vehicleId: vehicle.id, ...plan.createItem } });
      if (plan.syncDocumentExpiry) {
        const { type, expiresAt } = plan.syncDocumentExpiry;
        await updateDocuments.mutateAsync({ id: vehicle.id, documents: vehicle.documents.map((doc) => (doc.type === type ? { ...doc, expiresAt } : doc)) });
      }
      onSaved();
      onClose();
    } catch (failure) {
      setError(describeSaveError(failure, t, 'vehicleDetail.dues.edit.saveError'));
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

  return (
    <View style={{ gap: 16, padding: 14, marginBottom: 12, borderRadius: 18, backgroundColor: Palette.surface }}>
      <DueFields type={row.type} vehicle={vehicle} draft={draft} setDraft={setDraft} showErrors={showErrors} now={now} />
      <DueActions onSave={() => void save()} onCancel={onClose} busy={busy} error={error} />
      {row.maintenanceId ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {canDelete ? <DangerLink label={t('vehicleDetail.dues.edit.delete')} onPress={confirmDelete} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Échéances complètes, modifiables SUR PLACE : une ligne par échéance (assurance, visite technique, entretiens) ; un toucher la déplie
 * pour corriger la date et le kilométrage ; « + Ajouter » ouvre le formulaire dans la carte.
 */
export function DuesSection({ vehicle, rows: allRows, now, openKind = null, readOnly = false, onEdit }: { vehicle: Vehicle; rows: DueRow[]; now: Date; openKind?: ComplianceKind | null; /** Fiche du véhicule : échéances prévues en lecture seule ; « Modifier » ouvre l'onglet « Échéances » de la page de modification. */ readOnly?: boolean; onEdit?: (target?: { kind?: ComplianceKind }) => void }) {
  // L'assurance et la visite technique sont dans « Obligations légales » (ComplianceBlock) : ici, seulement les entretiens.
  const rows = allRows.filter((row) => row.type !== 'assurance' && row.type !== 'visite_technique');
  const { t, language } = useLanguage();
  const agency = useMyAgency();
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [saved, setSaved] = useState(false);
  const canDelete = agency.data?.role === 'owner' || agency.data?.role === 'manager';
  const dueText = (row: DueRow) => {
    if (row.incomplete) return t('vehicleDetail.dues.incomplete');
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
    if (row.incomplete) return t('vehicleDetail.dues.incompleteSub');
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
        {readOnly ? (
          <Pressable onPress={() => onEdit?.()} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.dues.editA11y')} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
            <HText weight="semibold" size={13} color={Brand.orangeUrgentText}>
              {t('vehicleDetail.dues.editLink')}
            </HText>
          </Pressable>
        ) : null}
      </View>

      {saved ? (
        <HText size={13} weight="bold" color={Palette.success} accessibilityRole="alert">
          {t('vehicleDetail.dues.edit.savedNote')}
        </HText>
      ) : null}

      <ComplianceBlock vehicle={vehicle} now={now} openKind={openKind} readOnly={readOnly} onOpenKind={(kind) => onEdit?.({ kind })} />

      <HText weight="semibold" size={11} track={0.14} color={Palette.textSecondary} style={{ marginTop: 12, marginBottom: 2 }}>
        {t('vehicleDetail.compliance.maintenance').toLocaleUpperCase()}
      </HText>

      {rows.length === 0 && open !== 'new' ? (
        <HText size={13} color={Palette.textSecondary}>
          {t('vehicleDetail.dues.edit.empty')}
        </HText>
      ) : null}

      {rows.map((row) => {
        const hot = row.urgency === 'hot' || row.urgency === 'expired';
        const label = row.label ?? t(`maintenance.types.${row.type}`);
        const due = dueText(row);
        const sub = subText(row);
        const expanded = open === row.key;
        return (
          <View key={row.key} style={{ borderTopWidth: 1, borderTopColor: Brand.gaugeTrack }}>
            <Pressable
              onPress={() => {
                if (readOnly) return onEdit?.();
                setOpen(expanded ? null : row.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={t('vehicleDetail.dues.a11y', { label, due, sub })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 56 }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hot ? Palette.primary : Palette.surfaceAlt }}>
                <TileIconView icon={DUE_TYPE_IMAGE[row.type] ?? DUE_ICON[row.icon]} size={18} color={hot ? Brand.white : Brand.graphite} />
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
              <Ionicons name={readOnly ? 'chevron-forward' : expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Palette.textSecondary} />
            </Pressable>
            {expanded && !readOnly ? <EditDue row={row} vehicle={vehicle} now={now} canDelete={canDelete} onClose={() => setOpen(null)} onSaved={() => setSaved(true)} /> : null}
          </View>
        );
      })}

      {/* Bouton en bas de la liste ; au clic, le formulaire s'affiche à cette même place. */}
      {readOnly ? null : open === 'new' ? (
        <AddDue vehicle={vehicle} now={now} onClose={() => setOpen(null)} onSaved={() => setSaved(true)} />
      ) : (
        <Button variant="secondary" label={t('vehicleDetail.dues.add')} onPress={() => setOpen('new')} style={{ marginTop: 12 }} />
      )}
    </View>
  );
}
