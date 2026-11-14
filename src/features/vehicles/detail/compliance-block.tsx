import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button, CameraCapture, checkPhoto, ChoiceTiles, DateField, DocumentSlot, FormField, Segmented } from '@/components/form';
import { Brand, Palette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { isAlreadyRecordedError } from '@/features/compliance/api';
import { useComplianceSettings, useCorrectCompliance, useDeleteCompliance, useRenewCompliance, useSaveComplianceSettings, useVehicleCompliance } from '@/features/compliance/hooks';
import {
  allStatuses,
  historyOf,
  periodOf,
  renewalDraft,
  renewalEnd,
  renewalInput,
  suggestRenewal,
  toDisplayDate,
  validateRenewal,
  type ComplianceStatus,
  type RenewalDraft,
  type RenewalErrors,
} from '@/features/compliance/logic';
import { COMPLIANCE_KINDS, type ComplianceKind, type ComplianceRecord } from '@/features/compliance/types';
import { formatAmount, HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { canSeePrices } from '../fleet-card';
import type { Vehicle } from '../types';
import { fromIsoDate, toIsoDate } from '../validation';

const ICON: Record<ComplianceKind, keyof typeof Ionicons.glyphMap> = { assurance: 'shield-checkmark-outline', visite_technique: 'clipboard-outline', vignette: 'receipt-outline' };
const STATE_COLOR = { none: Palette.textSecondary, valid: Palette.success, soon: Brand.orangeUrgentText, urgent: Brand.orangeUrgentText, expired: Palette.error } as const;
const STATE_BAR = { none: Palette.border, valid: Palette.success, soon: Palette.warning, urgent: Palette.primary, expired: Palette.error } as const;
const dayLabel = (iso: string, language: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

type T = (key: string, params?: Record<string, unknown>) => string;

/** Ligne de situation sous le nom : « Du … au … », « Expire aujourd'hui », « Date limite : … ». */
export function statusLine(status: ComplianceStatus, t: T, language: string): string {
  if (status.kind === 'vignette') {
    // Rien d'enregistré : on n'affiche la date limite que si elle est encore à venir (sinon une date passée ferait croire à un retard).
    if (!status.record) return status.due && status.days !== null && status.days >= 0 ? t('vehicleDetail.compliance.deadline', { date: dayLabel(status.due, language) }) : t('vehicleDetail.compliance.none');
    if (status.state === 'expired') return t('vehicleDetail.compliance.deadlineOver', { date: dayLabel(status.due as string, language) });
    return t('vehicleDetail.compliance.nextDeadline', { date: dayLabel(status.due as string, language) });
  }
  const record = status.record;
  if (!record) return t('vehicleDetail.compliance.none');
  if (status.days === null) return '';
  if (status.days < 0) return t(status.days === -1 ? 'vehicleDetail.compliance.expiredAgoOne' : 'vehicleDetail.compliance.expiredAgo', { n: -status.days });
  if (status.days === 0) return t('vehicleDetail.compliance.today');
  const range = record.validFrom ? t('vehicleDetail.compliance.period', { from: dayLabel(record.validFrom, language), to: dayLabel(record.validUntil, language) }) : t('vehicleDetail.compliance.periodUntil', { to: dayLabel(record.validUntil, language) });
  return status.state === 'valid' ? range : `${range} · ${t(status.days === 1 ? 'vehicleDetail.compliance.daysLeftOne' : 'vehicleDetail.compliance.daysLeft', { n: status.days })}`;
}

function Fields({ kind, draft, setDraft, errors, showAmount, currentEnd, localUri, onPick, withPhoto }: { kind: ComplianceKind; draft: RenewalDraft; setDraft: (draft: RenewalDraft) => void; errors: RenewalErrors; showAmount: boolean; currentEnd: string | null; localUri: string | null; onPick: (uri: string) => void; withPhoto: boolean }) {
  const { t } = useLanguage();
  const message = (field: keyof RenewalErrors) => {
    const code = errors[field];
    return code ? t(`vehicleDetail.compliance.errors.${code}`, { date: currentEnd ? toDisplayDate(currentEnd) : '' }) : undefined;
  };
  const [camera, setCamera] = useState(false);
  const [photoProblem, setPhotoProblem] = useState<'too_small' | 'unreadable' | null>(null);
  async function onCaptured(uri: string) {
    setCamera(false);
    const check = await checkPhoto(uri);
    if (!check.ok) {
      setPhotoProblem(check.reason);
      return;
    }
    setPhotoProblem(null);
    onPick(uri);
  }
  const show = Object.keys(errors).length > 0;
  return (
    <View style={{ gap: 16 }}>
      <DateField label={t('vehicleDetail.compliance.validFrom')} value={toIsoDate(draft.validFrom)} onChange={(iso) => setDraft({ ...draft, validFrom: fromIsoDate(iso) })} error={message('validFrom')} showError={show} />
      <DateField label={t('vehicleDetail.compliance.validUntil')} value={toIsoDate(draft.validUntil)} onChange={(iso) => setDraft({ ...draft, validUntil: fromIsoDate(iso) })} error={message('validUntil')} showError={show} />
      <FormField label={t(`vehicleDetail.compliance.ref.${kind}`)} value={draft.reference} onChangeText={(value) => setDraft({ ...draft, reference: value })} placeholder={t(`vehicleDetail.compliance.refPlaceholder.${kind}`)} error={message('reference')} showError={show} ltr />
      {kind !== 'vignette' ? <FormField label={t(`vehicleDetail.compliance.provider.${kind}`)} value={draft.provider} onChangeText={(value) => setDraft({ ...draft, provider: value })} placeholder={t(`vehicleDetail.compliance.providerPlaceholder.${kind}`)} error={message('provider')} showError={show} autoCapitalize="words" /> : null}
      {showAmount ? <FormField label={t('vehicleDetail.compliance.amount')} value={draft.amount} onChangeText={(value) => setDraft({ ...draft, amount: value.replace(/[^\d.,]/g, '') })} keyboardType="decimal-pad" unit="MAD" placeholder={t('vehicleDetail.compliance.amountPlaceholder')} error={message('amount')} showError={show} /> : null}
      {withPhoto ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row' }}>
            <DocumentSlot label={t('vehicleDetail.compliance.photo')} uri={localUri} onScan={() => setCamera(true)} onReplace={() => setCamera(true)} />
          </View>
          {photoProblem ? (
            <HText size={13} weight="semibold" color={Palette.error} accessibilityRole="alert">
              {t(photoProblem === 'too_small' ? 'vehicleForm.edit.scan.tooSmall' : 'vehicleForm.edit.scan.unreadable')}
            </HText>
          ) : null}
          <CameraCapture visible={camera} onClose={() => setCamera(false)} onCapture={(uri) => void onCaptured(uri)} hint={t('vehicleDetail.compliance.photoHint')} />
        </View>
      ) : null}
      <FormField label={t('vehicleDetail.compliance.notes')} value={draft.notes} onChangeText={(value) => setDraft({ ...draft, notes: value })} placeholder={t('vehicleDetail.compliance.notesPlaceholder')} multiline />
    </View>
  );
}

/** Un seul bouton orange par formulaire (Enregistrer), « Annuler » en secondaire, le message d'échec dessous. */
function FormButtons({ onSave, onCancel, busy, error }: { onSave: () => void; onCancel: () => void; busy: boolean; error: string | null }) {
  const { t } = useLanguage();
  return (
    <View style={{ gap: 10 }}>
      {error ? (
        <HText size={13} weight="semibold" color={Palette.error} accessibilityRole="alert">
          {error}
        </HText>
      ) : null}
      <Button label={t('vehicleDetail.editor.save')} loadingLabel={t('vehicleDetail.editor.saving')} loading={busy} onPress={onSave} accessibilityLabel={t('vehicleDetail.editor.save')} />
      <Button variant="secondary" label={t('vehicleDetail.editor.cancel')} onPress={onCancel} disabled={busy} />
    </View>
  );
}

/** Renouvellement (ou premier enregistrement) : période proposée, n° de police, assureur, montant (propriétaire), photo du papier. */
function RenewForm({ vehicle, kind, current, settings, showAmount, onClose, now }: { vehicle: Vehicle; kind: ComplianceKind; current: ComplianceRecord | null; settings: { visitIntervalMonths: number }; showAmount: boolean; onClose: () => void; now: Date }) {
  const { t } = useLanguage();
  const agency = useMyAgency();
  const renew = useRenewCompliance();
  const [draft, setDraft] = useState<RenewalDraft>(() => renewalDraft(suggestRenewal(kind, current, settings, now)));
  // Durée de la période : réglée une fois, reprise automatiquement aux renouvellements suivants.
  const [months, setMonths] = useState<number | null>(() => periodOf(kind, current, settings));
  // « Une seule fois » : la durée n'est pas mémorisée (le renouvellement suivant repart des valeurs d'usage).
  const [periodic, setPeriodic] = useState(true);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = validateRenewal(draft, current);

  function save() {
    setShowErrors(true);
    setError(null);
    if (Object.keys(errors).length > 0 || !agency.data) return;
    renew.mutate(
      { agencyId: agency.data.agencyId, input: renewalInput(vehicle.id, kind, { ...draft, amount: showAmount ? draft.amount : '' }, null, periodic ? months : null), localDocumentUri: localUri },
      { onSuccess: onClose, onError: (failure) => setError(isAlreadyRecordedError(failure) ? t('vehicleDetail.compliance.alreadyRecorded') : localUri ? t('vehicleDetail.compliance.uploadError') : t('vehicleDetail.compliance.saveError')) }
    );
  }

  return (
    <View style={{ gap: 16, padding: 14, borderRadius: 18, backgroundColor: Palette.surface }}>
      <HText font="display" weight="bold" size={16} accessibilityRole="header">
        {t(current ? 'vehicleDetail.compliance.renewTitle' : 'vehicleDetail.compliance.firstTitle', { kind: t(`vehicleDetail.compliance.kind.${kind}`) })}
      </HText>
      {months !== null ? (
        <Segmented<'once' | 'periodic'>
          label={t('vehicleDetail.compliance.repeatLabel')}
          value={periodic ? 'periodic' : 'once'}
          onChange={(value) => setPeriodic(value === 'periodic')}
          options={[
            { value: 'once', label: t('vehicleDetail.compliance.repeatOnce') },
            { value: 'periodic', label: t('vehicleDetail.compliance.repeatPeriodic') },
          ]}
        />
      ) : null}
      {months !== null && periodic ? (
        <ChoiceTiles<string>
          label={t('vehicleDetail.compliance.duration')}
          value={String(months)}
          onChange={(value) => {
            const next = Number(value);
            setMonths(next);
            const from = toIsoDate(draft.validFrom) ?? new Date().toISOString().slice(0, 10);
            setDraft({ ...draft, validUntil: toDisplayDate(renewalEnd(kind, from, next)) });
          }}
          options={[...new Set([3, 6, 12, 24, months])].sort((a, b) => a - b).map((value) => ({ value: String(value), label: t('vehicleDetail.compliance.durationMonths', { n: value }), icon: 'repeat-outline' as const }))}
        />
      ) : null}
      <Fields kind={kind} draft={draft} setDraft={setDraft} errors={showErrors ? errors : {}} showAmount={showAmount} currentEnd={current?.validUntil ?? null} localUri={localUri} onPick={setLocalUri} withPhoto />
      <FormButtons onSave={save} onCancel={onClose} busy={renew.isPending} error={error} />
    </View>
  );
}

/** Correction d'une période de l'historique (propriétaire et responsable). */
function CorrectForm({ vehicle, record, showAmount, onClose }: { vehicle: Vehicle; record: ComplianceRecord; showAmount: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const correct = useCorrectCompliance();
  const [draft, setDraft] = useState<RenewalDraft>({ validFrom: toDisplayDate(record.validFrom), validUntil: toDisplayDate(record.validUntil), reference: record.reference ?? '', provider: record.provider ?? '', amount: record.amount !== null ? String(record.amount) : '', notes: record.notes ?? '' });
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = validateRenewal(draft, null);

  function save() {
    setShowErrors(true);
    setError(null);
    if (Object.keys(errors).length > 0) return;
    const input = renewalInput(vehicle.id, record.kind, draft, record.documentPath);
    correct.mutate(
      { id: record.id, vehicleId: vehicle.id, patch: { validFrom: input.validFrom, validUntil: input.validUntil, reference: input.reference, provider: input.provider, amount: showAmount ? input.amount : record.amount, notes: input.notes } },
      { onSuccess: onClose, onError: (failure) => setError(isAlreadyRecordedError(failure) ? t('vehicleDetail.compliance.alreadyRecorded') : t('vehicleDetail.compliance.saveError')) }
    );
  }

  return (
    <View style={{ gap: 16, padding: 14, borderRadius: 18, backgroundColor: Palette.surface }}>
      <HText font="display" weight="bold" size={16} accessibilityRole="header">
        {t('vehicleDetail.compliance.correctTitle')}
      </HText>
      <Fields kind={record.kind} draft={draft} setDraft={setDraft} errors={showErrors ? errors : {}} showAmount={showAmount} currentEnd={null} localUri={null} onPick={() => undefined} withPhoto={false} />
      <FormButtons onSave={save} onCancel={onClose} busy={correct.isPending} error={error} />
    </View>
  );
}

/** Périodicité de la visite technique (réglage de l'agence). */
function PeriodicityEditor({ agencyId, months, canEdit }: { agencyId: string; months: number; canEdit: boolean }) {
  const { t } = useLanguage();
  const save = useSaveComplianceSettings();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: 8, paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <HText size={13} color={Palette.textSecondary} style={{ flex: 1 }}>
          {t('vehicleDetail.compliance.periodicity', { n: months })}
        </HText>
        {canEdit ? (
          <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.compliance.periodicityChange')} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
            <HText weight="semibold" size={12} color={Brand.orangeUrgentText}>
              {t('vehicleDetail.compliance.periodicityChange')}
            </HText>
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <View style={{ gap: 8 }}>
          <ChoiceTiles<string>
            label={t('vehicleDetail.compliance.periodicityChange')}
            value={String(months)}
            options={['3', '6', '12', '24'].map((value) => ({ value, label: t('vehicleDetail.compliance.periodicityMonths', { n: value }), icon: 'calendar-outline' as const }))}
            onChange={(value) => {
              setError(null);
              save.mutate({ agencyId, settings: { visitIntervalMonths: Number(value) } }, { onSuccess: () => setOpen(false), onError: () => setError(t('vehicleDetail.compliance.saveError')) });
            }}
          />
          <HText size={11} color={Palette.textSecondary}>
            {t('vehicleDetail.compliance.periodicityHint')}
          </HText>
          {error ? (
            <HText size={12} color={Palette.error} accessibilityRole="alert">
              {error}
            </HText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function HistoryRow({ vehicle, record, isCurrent, canManage, showAmount }: { vehicle: Vehicle; record: ComplianceRecord; isCurrent: boolean; canManage: boolean; showAmount: boolean }) {
  const { t, language } = useLanguage();
  const remove = useDeleteCompliance();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (editing) return <CorrectForm vehicle={vehicle} record={record} showAmount={showAmount} onClose={() => setEditing(false)} />;
  const period = record.validFrom ? t('vehicleDetail.compliance.period', { from: dayLabel(record.validFrom, language), to: dayLabel(record.validUntil, language) }) : t('vehicleDetail.compliance.periodUntil', { to: dayLabel(record.validUntil, language) });
  const details = [record.reference, record.provider, showAmount && record.amount !== null ? `${formatAmount(record.amount)} MAD` : null].filter(Boolean).join(' · ');

  function confirmDelete() {
    Alert.alert(t('vehicleDetail.compliance.deleteTitle'), t('vehicleDetail.compliance.deleteBody'), [
      { text: t('vehicleDetail.editor.cancel'), style: 'cancel' },
      { text: t('vehicleDetail.compliance.delete'), style: 'destructive', onPress: () => remove.mutate({ id: record.id, vehicleId: vehicle.id }, { onError: () => setError(t('vehicleDetail.compliance.forbidden')) }) },
    ]);
  }

  return (
    <View style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Brand.gaugeTrack }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <HText weight="semibold" size={13} style={{ flex: 1 }}>
          {period}
        </HText>
        {isCurrent ? (
          <HText weight="bold" size={11} color={Palette.success}>
            {t('vehicleDetail.compliance.current')}
          </HText>
        ) : null}
      </View>
      {details ? (
        <HText size={12} color={Palette.textSecondary}>
          {details}
        </HText>
      ) : null}
      <HText size={11} color={record.documentPath ? Palette.textSecondary : Brand.orangeUrgentText}>
        {record.documentPath ? t('vehicleDetail.compliance.paperOk') : t('vehicleDetail.compliance.paperMissing')}
      </HText>
      {error ? (
        <HText size={12} color={Palette.error} accessibilityRole="alert">
          {error}
        </HText>
      ) : null}
      {canManage ? (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <HText weight="semibold" size={12} color={Brand.orangeUrgentText}>
              {t('vehicleDetail.compliance.correct')}
            </HText>
          </Pressable>
          <Pressable onPress={confirmDelete} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <HText weight="semibold" size={12} color={Palette.error}>
              {t('vehicleDetail.compliance.delete')}
            </HText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Les trois obligations d'un véhicule : état du jour, période en cours, renouvellement et historique, tout sur place. */
export function ComplianceBlock({ vehicle, now }: { vehicle: Vehicle; now: Date }) {
  const { t, language } = useLanguage();
  const agency = useMyAgency();
  const recordsQuery = useVehicleCompliance(vehicle.id);
  const { settings } = useComplianceSettings(agency.data?.agencyId);
  const [open, setOpen] = useState<ComplianceKind | null>(null);
  const [mode, setMode] = useState<'view' | 'renew'>('view');
  const records = recordsQuery.data ?? [];
  const statuses = allStatuses(records, vehicle, now);
  const role = agency.data?.role;
  const canManage = role === 'owner' || role === 'manager';
  const showAmount = canSeePrices(role);

  return (
    <View style={{ gap: 2 }}>
      <HText weight="semibold" size={11} track={0.14} color={Palette.textSecondary} style={{ marginTop: 4, marginBottom: 2 }}>
        {t('vehicleDetail.compliance.title').toLocaleUpperCase()}
      </HText>
      {COMPLIANCE_KINDS.map((kind) => {
        const status = statuses.find((entry) => entry.kind === kind) as ComplianceStatus;
        const expanded = open === kind;
        const kindLabel = t(`vehicleDetail.compliance.kind.${kind}`);
        const stateLabel = t(`vehicleDetail.compliance.state.${status.state}`);
        const line = statusLine(status, t, language);
        const history = historyOf(records, kind);
        const hot = status.state === 'urgent' || status.state === 'expired';
        const fill = status.state === 'valid' ? 0.12 : status.state === 'none' ? 0 : status.state === 'soon' ? 0.55 : 1;
        return (
          <View key={kind} style={{ borderTopWidth: 1, borderTopColor: Brand.gaugeTrack }}>
            <Pressable
              onPress={() => {
                setOpen(expanded ? null : kind);
                setMode('view');
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={t('vehicleDetail.compliance.rowA11y', { kind: kindLabel, state: stateLabel, line })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 60 }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hot ? (status.state === 'expired' ? Palette.error : Palette.primary) : Palette.surfaceAlt }}>
                <Ionicons name={ICON[kind]} size={18} color={hot ? Brand.white : Brand.graphite} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <HText weight="semibold" size={14} style={{ flexShrink: 1 }}>
                    {kindLabel}
                  </HText>
                  <HText weight="bold" size={12} color={STATE_COLOR[status.state]}>
                    {stateLabel}
                  </HText>
                </View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: Brand.gaugeTrack, overflow: 'hidden', flexDirection: 'row' }}>
                  <View style={{ width: `${Math.round(fill * 100)}%`, borderRadius: 3, backgroundColor: STATE_BAR[status.state] }} />
                </View>
                <HText size={11} color={Palette.textSecondary}>
                  {line}
                </HText>
                {status.record && !status.record.documentPath ? (
                  <HText size={11} color={Brand.orangeUrgentText}>
                    {t('vehicleDetail.compliance.paperMissing')}
                  </HText>
                ) : null}
              </View>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Palette.textSecondary} />
            </Pressable>

            {expanded ? (
              <View style={{ gap: 12, paddingBottom: 12 }}>
                {mode === 'renew' ? (
                  <RenewForm vehicle={vehicle} kind={kind} current={status.record} settings={settings} showAmount={showAmount} now={now} onClose={() => setMode('view')} />
                ) : (
                  <>
                    <Button label={t('vehicleDetail.compliance.renew')} onPress={() => setMode('renew')} accessibilityLabel={t('vehicleDetail.compliance.renew')} />
                    {kind === 'visite_technique' && agency.data ? <PeriodicityEditor agencyId={agency.data.agencyId} months={settings.visitIntervalMonths} canEdit={canManage} /> : null}
                    <HText weight="semibold" size={12} color={Palette.textSecondary}>
                      {t('vehicleDetail.compliance.history')}
                    </HText>
                    {history.length === 0 ? (
                      <HText size={12} color={Palette.textSecondary}>
                        {t('vehicleDetail.compliance.historyEmpty')}
                      </HText>
                    ) : (
                      history.map((record) => <HistoryRow key={record.id} vehicle={vehicle} record={record} isCurrent={record.id === status.record?.id} canManage={canManage} showAmount={showAmount} />)
                    )}
                  </>
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
