import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation, usePreventRemove } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  CameraCapture,
  checkPhoto,
  ChoiceTiles,
  ColorSwatches,
  DangerLink,
  DateField,
  DocumentList,
  DocumentSlot,
  EmptyState,
  FormField,
  InfoBanner,
  NumberStepper,
  PriceStepper,
  SAVE_BAR_SPACE,
  SaveBar,
  SectionLabel,
  SelectField,
  Segmented,
  suggestWeekMonth,
  useKeyboardHeight,
  Panel,
  type ListOption,
} from '@/components/form';
import { Brand, Palette } from '@/constants/theme';
import { useMyAgency, useMyProfile } from '@/features/agency/hooks';
import type { ComplianceRecord } from '@/features/compliance/types';
import type { Customer } from '@/features/customers/types';
import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';
import { useBranches } from '@/features/branches/hooks';
import { complianceStatus, toDisplayDate } from '@/features/compliance/logic';
import { useVehicleCompliance } from '@/features/compliance/hooks';
import { useCustomers } from '@/features/customers/hooks';
import { formatAmount, HText } from '@/features/dashboard/home-ui';
import { useCreateMaintenanceItem, useVehicleMaintenanceItems } from '@/features/maintenance/hooks';
import { useVehicleRentals } from '@/features/rentals/hooks';
import { mergeDocuments } from '@/features/storage/documents';
import { useSignedUrl } from '@/features/storage/hooks';
import { availabilityAlertList, availabilityAlerts, statusBlockText } from './status-guard';
import { useLanguage } from '@/i18n/use-language';

import { prepareVehiclePhoto, uploadVehicleDocument, VEHICLE_DOCUMENTS_BUCKET } from './api';
import { archiveBlock } from './archive-guard';
import { archiveReasonText } from './detail/archive-section';
import { buildDues } from './detail/dues';
import { displayName } from './detail/names';
import { canSeePrices, formatDayLabel } from './fleet-card';
import { applyScan, buildInput, changedFields, draftFromVehicle, firstErrorField, missingAfterScan, validateDraft, type FieldKey, type FormDraft } from './form/model';
import { useFieldScroll } from './form/use-field-scroll';
import { useArchiveVehicle, useUpdateVehicle } from './hooks';
import { scanVehicleDocuments } from './ocr';
import { FUEL_TYPES, MANUAL_VEHICLE_STATUSES, VEHICLE_CATEGORIES, type FuelType, type Vehicle, type VehicleCategory, type VehicleDocument, type VehicleStatus, type VehicleTransmission } from './types';
import { duplicateVehicleField } from './validation';

type Face = 'recto' | 'verso';
const NO_MAINTENANCE: MaintenanceItem[] = [];
const NO_COMPLIANCE: ComplianceRecord[] = [];
const NO_RENTALS: Rental[] = [];
const NO_CUSTOMERS: Customer[] = [];
const CATEGORY_ICON: Record<VehicleCategory, keyof typeof Ionicons.glyphMap> = { economique: 'car-outline', compacte: 'car-sport-outline', berline: 'car-outline', suv: 'car-sport', utilitaire: 'cube-outline', minibus: 'bus-outline', luxe: 'diamond-outline' };
const STATUS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = { disponible: 'checkmark-circle-outline', maintenance: 'construct-outline', en_preparation: 'clipboard-outline', indisponible: 'ban-outline' };

function InlineError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name="alert-circle-outline" size={14} color={Palette.error} />
      <HText weight="semibold" size={12} color={Palette.error} style={{ flex: 1 }}>
        {message}
      </HText>
    </View>
  );
}

/** Feuille « Ajouter une vidange » : une échéance créée tout de suite (requête séparée de la barre d'enregistrement). */
function AddOilSheet({ vehicleId, visible, onClose }: { vehicleId: string; visible: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const agency = useMyAgency();
  const create = useCreateMaintenanceItem();
  const [date, setDate] = useState<string | null>(null);
  const [km, setKm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ready = !!date || km.trim() !== '';

  function add() {
    if (!agency.data || !ready) return;
    setError(null);
    create.mutate(
      { agencyId: agency.data.agencyId, input: { vehicleId, type: 'vidange', echeanceDate: date, echeanceKm: km.trim() ? Number(km) : null, notes: null } },
      {
        onSuccess: () => {
          setDate(null);
          setKm('');
          onClose();
        },
        onError: () => setError(t('vehicleForm.edit.due.sheetFailed')),
      }
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: Palette.overlay }} onPress={onClose} accessibilityLabel={t('form.close')} />
      <View style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, gap: 16 }}>
        <HText font="display" weight="bold" size={18} accessibilityRole="header">
          {t('vehicleForm.edit.due.sheetTitle')}
        </HText>
        <DateField label={t('vehicleForm.edit.due.sheetDate')} value={date} onChange={setDate} minimumDate={new Date()} />
        <FormField label={t('vehicleForm.edit.due.sheetKm')} value={km} onChangeText={setKm} thousands unit={t('vehicleForm.edit.units.km')} placeholder={t('vehicleForm.edit.ph.kilometrage')} />
        {error ? <InlineError message={error} /> : null}
        <Button label={t('vehicleForm.edit.due.sheetAdd')} onPress={add} loading={create.isPending} loadingLabel={t('form.saving')} disabled={!ready} disabledReason={t('vehicleForm.edit.due.sheetDisabled')} />
      </View>
    </Modal>
  );
}

/** « Modifier la fiche technique » : une page qui défile, une seule barre d'enregistrement, un seul enregistrement (photos puis une requête). */
export function VehicleForm({ vehicle, scrollToField = null }: { vehicle: Vehicle; scrollToField?: string | null }) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const navigation = useNavigation();
  const { scrollRef, onScroll, register, scrollTo } = useFieldScroll();

  const agency = useMyAgency();
  const agencyId = agency.data?.agencyId;
  const role = agency.data?.role;
  const showPrices = canSeePrices(role);
  const isManager = role === 'owner' || role === 'manager';
  const profile = useMyProfile(agencyId);
  const branches = useBranches(agencyId).data ?? [];
  const canChooseBranch = profile.data?.branchId === null && branches.length > 0;
  const maintenance = useVehicleMaintenanceItems(vehicle.id).data ?? NO_MAINTENANCE;
  const compliance = useVehicleCompliance(vehicle.id).data ?? NO_COMPLIANCE;
  const rentals = useVehicleRentals(vehicle.id).data ?? NO_RENTALS;
  const customerList = useCustomers().data ?? NO_CUSTOMERS;
  const updateVehicle = useUpdateVehicle();
  const archiveVehicle = useArchiveVehicle();

  const [initial] = useState(() => draftFromVehicle(vehicle));
  const [draft, setDraft] = useState<FormDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exit, setExit] = useState<'back' | 'list' | null>(null);
  const [faces, setFaces] = useState<Record<Face, string | null>>({ recto: null, verso: null });
  const [camera, setCamera] = useState<Face | null>(null);
  const [problem, setProblem] = useState<{ face: Face; reason: 'too_small' | 'unreadable' } | null>(null);
  const [reading, setReading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState<FieldKey[]>([]);
  const [expiry, setExpiry] = useState<string | null>(null);
  const [oilSheet, setOilSheet] = useState(false);
  const [viewer, setViewer] = useState<{ uri: string; label: string } | null>(null);
  const [now] = useState(() => new Date());

  const set = <K extends keyof FormDraft>(key: K, value: FormDraft[K]) => setDraft((previous) => ({ ...previous, [key]: value }));
  const errors = validateDraft(draft, { showPrices, initialKm: initial.kilometrage });
  const changed = changedFields(initial, draft);
  const dirty = changed.length > 0 || !!faces.recto || !!faces.verso;
  const label = (key: string) => t(`vehicleForm.edit.f.${key}`);
  const message = (key: FieldKey) => (submitted && errors[key] ? t(`vehicleForm.edit.err.${errors[key]?.code}`, errors[key]?.params) : undefined);
  const ai = (key: FieldKey) => aiFilled.includes(key);

  // Quitter avec des modifications non enregistrées : confirmation.
  usePreventRemove(dirty && !saving && exit === null, ({ data }) => {
    Alert.alert(t('form.leaveTitle'), t('form.leaveBody'), [
      { text: t('form.stay'), style: 'cancel' },
      { text: t('form.leave'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  useEffect(() => {
    if (exit === 'back') router.back();
    else if (exit === 'list') router.replace('/flotte');
  }, [exit]);
  useEffect(() => {
    if (scrollToField) {
      const timer = setTimeout(() => scrollTo(scrollToField), 350);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [scrollToField, scrollTo]);

  // Documents déjà enregistrés (carte grise).
  const existing = (type: 'carte_grise' | 'carte_grise_verso') => vehicle.documents.find((doc) => doc.type === type && !!doc.path)?.path;
  const rectoSigned = useSignedUrl(VEHICLE_DOCUMENTS_BUCKET, existing('carte_grise')).data ?? null;
  const versoSigned = useSignedUrl(VEHICLE_DOCUMENTS_BUCKET, existing('carte_grise_verso')).data ?? null;
  const insuranceDoc = vehicle.documents.find((doc) => doc.type === 'assurance' && !!doc.path)?.path;
  const visitDoc = vehicle.documents.find((doc) => doc.type === 'visite_technique' && !!doc.path)?.path;
  const insuranceThumb = useSignedUrl(VEHICLE_DOCUMENTS_BUCKET, insuranceDoc).data ?? null;
  const visitThumb = useSignedUrl(VEHICLE_DOCUMENTS_BUCKET, visitDoc).data ?? null;
  const uriOf = (face: Face) => faces[face] ?? (face === 'recto' ? rectoSigned : versoSigned);

  async function onCaptured(face: Face, uri: string) {
    setCamera(null);
    const check = await checkPhoto(uri);
    if (!check.ok) {
      setProblem({ face, reason: check.reason });
      return;
    }
    setProblem(null);
    const next = { ...faces, [face]: uri };
    setFaces(next);
    const uris = [next.recto, next.verso].filter((value): value is string => !!value);
    setReading(true);
    setScanError(null);
    const result = await scanVehicleDocuments(uris, { agencyId });
    setReading(false);
    if (!result.ok) {
      setScanError(t(result.error === 'ocr_disabled' || result.error === 'ocr_not_configured' ? 'vehicleForm.edit.scan.disabled' : 'vehicleForm.edit.scan.failed'));
      return;
    }
    const applied = applyScan(draft, result.fields);
    setDraft(applied.draft);
    setAiFilled((previous) => [...previous, ...applied.filled.filter((key) => !previous.includes(key))]);
    if (result.fields.dateFinValidite.value) setExpiry(result.fields.dateFinValidite.value);
  }

  async function save() {
    setSubmitted(true);
    setSaveError(null);
    const first = firstErrorField(errors);
    if (first) {
      scrollTo(first);
      return;
    }
    if (!agencyId) return;
    setSaving(true);
    try {
      // 1. Photos (stockage : aucune écriture en base). Si une envoi échoue, rien n'est enregistré.
      const uploaded: VehicleDocument[] = [];
      try {
        for (const face of ['recto', 'verso'] as const) {
          const uri = faces[face];
          if (!uri) continue;
          const prepared = await prepareVehiclePhoto(uri);
          uploaded.push(await uploadVehicleDocument(agencyId, vehicle.id, face === 'recto' ? 'carte_grise' : 'carte_grise_verso', prepared, face === 'recto' ? (expiry ?? vehicle.documents.find((doc) => doc.type === 'carte_grise')?.expiresAt ?? null) : null));
        }
      } catch {
        setSaveError(t('vehicleForm.edit.saving.uploadFailed'));
        return;
      }
      // 2. UNE requête : la fiche technique et les documents ensemble.
      await updateVehicle.mutateAsync({ id: vehicle.id, input: buildInput(draft, vehicle, { showPrices, canChooseBranch }), documents: uploaded.length > 0 ? mergeDocuments(vehicle.documents, uploaded) : undefined });
      setExit('back');
    } catch (error) {
      const duplicate = duplicateVehicleField(error);
      setSaveError(duplicate === 'vin' ? t('vehicle.form.duplicateVinError') : duplicate === 'immatriculation' ? t('vehicle.form.duplicatePlateError') : t('vehicleForm.edit.saving.failed'));
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(initial);
    setFaces({ recto: null, verso: null });
    setProblem(null);
    setScanError(null);
    setAiFilled([]);
    setSubmitted(false);
    setSaveError(null);
  }

  // Échéances : la plus proche parmi les obligations et les entretiens.
  const nextDue = useMemo(() => {
    const items: { name: string; date: string; state: 'valid' | 'soon' | 'urgent' | 'expired' }[] = [];
    for (const kind of ['assurance', 'visite_technique'] as const) {
      const status = complianceStatus(kind, compliance, vehicle, now);
      if (status.record && status.due && status.state !== 'none') items.push({ name: t(`vehicleForm.edit.docs.${kind}`), date: status.due, state: status.state });
    }
    for (const row of buildDues({ vehicle, maintenance, now })) {
      if (row.type === 'assurance' || row.type === 'visite_technique' || !row.date) continue;
      items.push({ name: t(`maintenance.types.${row.type}`), date: row.date, state: row.urgency === 'expired' ? 'expired' : row.urgency === 'hot' ? 'urgent' : row.urgency === 'normal' ? 'soon' : 'valid' });
    }
    return items.sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  }, [compliance, maintenance, vehicle, now, t]);

  const block = archiveBlock(vehicle, rentals, new Map(customerList.map((customer) => [customer.id, customer])), now);

  // Statut : impossible à changer si la voiture est réservée ou en location (on dit chez qui) ; une échéance en alerte n'empêche pas de la
  // rendre disponible : simple alerte, on confirme pour passer outre.
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  function chooseStatus(next: VehicleStatus) {
    if (next === draft.statut) return;
    if (block) {
      setStatusMessage(statusBlockText(block, t, language, now));
      return;
    }
    setStatusMessage(null);
    const alerts = next === 'disponible' ? availabilityAlerts(vehicle, compliance, maintenance, now) : [];
    if (alerts.length === 0) return set('statut', next);
    Alert.alert(t('vehicleDetail.availability.title'), t('vehicleDetail.availability.body', { list: availabilityAlertList(alerts, t) }), [
      { text: t('vehicleDetail.availability.cancel'), style: 'cancel' },
      { text: t('vehicleDetail.availability.confirm'), onPress: () => set('statut', next) },
    ]);
  }
  function confirmArchive() {
    Alert.alert(t('vehicleForm.edit.archive.confirmTitle'), t('vehicleForm.edit.archive.confirmBody'), [
      { text: t('vehicleForm.edit.archive.cancel'), style: 'cancel' },
      { text: t('vehicleForm.edit.archive.confirm'), style: 'destructive', onPress: () => archiveVehicle.mutate(vehicle.id, { onSuccess: () => setExit('list'), onError: () => setSaveError(t('vehicleForm.edit.saving.failed')) }) },
    ]);
  }

  const missing = missingAfterScan(draft).map((key) => t(`vehicleForm.edit.missing.${key}`));
  const joined = missing.length <= 1 ? missing.join('') : `${missing.slice(0, -1).join(', ')} ${t('vehicleForm.edit.and')} ${missing[missing.length - 1]}`;
  const bannerStrong = aiFilled.length === 1 ? t('vehicleForm.edit.bannerFilledOne') : t('vehicleForm.edit.bannerFilled', { count: aiFilled.length });
  const changeLabels = [...changed.map((key) => (key === 'transmission' ? t('vehicleForm.edit.short.transmission') : label(key))), ...(faces.recto || faces.verso ? [label('documents')] : [])].map((text, index) => (index === 0 ? text : text.toLocaleLowerCase()));
  const week = suggestWeekMonth(draft.prixJour);
  const optionList = (values: readonly string[], key: string): ListOption[] => values.map((value) => ({ value, label: t(`vehicleForm.edit.${key}.${value}`) }));
  const visitStatus = complianceStatus('visite_technique', compliance, vehicle, now);
  const insuranceStatus = complianceStatus('assurance', compliance, vehicle, now);
  const dateText = (iso: string) => formatDayLabel(iso, language, 'short', now);
  const docRow = (kind: 'assurance' | 'visite_technique', status: typeof insuranceStatus, thumb: string | null) => ({
    key: kind,
    name: t(`vehicleForm.edit.docs.${kind}`),
    sub: status.record ? t('vehicleForm.edit.docs.expires', { date: dateText(status.record.validUntil) }) : t('vehicleForm.edit.docs.none'),
    thumbUri: thumb,
    action: { label: status.record ? t('vehicleForm.edit.docs.view') : t('vehicleForm.edit.docs.scan'), tone: status.record ? ('neutral' as const) : ('primary' as const), onPress: () => router.push({ pathname: '/flotte/[id]', params: { id: vehicle.id } }) },
  });
  const slotCount = aiFilled.length > 0 ? aiFilled.length : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.surface }}>
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={32}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: SAVE_BAR_SPACE + keyboard, gap: 22 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('vehicleForm.edit.close')} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Palette.border, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={18} color={Brand.graphite} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <HText font="display" weight="bold" size={18} accessibilityRole="header">
              {t('vehicleForm.edit.title')}
            </HText>
            <HText size={12} color={Palette.textSecondary} numberOfLines={1}>
              {`${displayName(vehicle)} · ${vehicle.immatriculation}`}
            </HText>
          </View>
        </View>

        {reading ? <InfoBanner strong={t('vehicleForm.edit.bannerReading')} /> : aiFilled.length > 0 ? <InfoBanner strong={bannerStrong} muted={missing.length > 0 ? t('vehicleForm.edit.bannerMissing', { list: joined }) : undefined} /> : null}
        {scanError ? <InlineError message={scanError} /> : null}

        <View ref={register('transmission')} collapsable={false} style={{ gap: 6 }}>
          <Segmented<VehicleTransmission> label={label('transmission')} value={draft.transmission} onChange={(value) => set('transmission', value)} options={[{ value: 'manuelle', label: t('vehicleForm.edit.gear.manuelle') }, { value: 'automatique', label: t('vehicleForm.edit.gear.automatique') }]} />
        </View>

        <View ref={register('categorie')} collapsable={false}>
          <ChoiceTiles<VehicleCategory> label={label('categorie')} value={draft.categorie} onChange={(value) => set('categorie', value)} options={VEHICLE_CATEGORIES.map((value) => ({ value, label: t(`vehicleForm.edit.category.${value}`), icon: CATEGORY_ICON[value] }))} />
        </View>

        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View ref={register('kilometrage')} collapsable={false} style={{ flex: 1 }}>
            <FormField label={label('kilometrage')} value={draft.kilometrage} onChangeText={(value) => set('kilometrage', value)} thousands unit={t('vehicleForm.edit.units.km')} placeholder={t('vehicleForm.edit.ph.kilometrage')} error={message('kilometrage')} showError={submitted} />
          </View>
          <View ref={register('puissanceFiscale')} collapsable={false} style={{ flex: 1 }}>
            <FormField label={label('puissanceFiscale')} value={draft.puissanceFiscale} onChangeText={(value) => set('puissanceFiscale', value.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" unit={t('vehicleForm.edit.units.cv')} placeholder={t('vehicleForm.edit.ph.puissanceFiscale')} help={t('vehicleForm.edit.help.puissanceFiscale')} aiRead={ai('puissanceFiscale')} error={message('puissanceFiscale')} showError={submitted} />
          </View>
        </View>

        <View ref={register('couleur')} collapsable={false}>
          <ColorSwatches label={label('couleur')} value={draft.couleur || null} onChange={(value) => set('couleur', value)} />
        </View>

        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View ref={register('nombrePlaces')} collapsable={false} style={{ flex: 1, gap: 6 }}>
            <NumberStepper label={label('nombrePlaces')} value={draft.nombrePlaces} onChange={(value) => set('nombrePlaces', value)} min={1} max={9} />
            <InlineError message={message('nombrePlaces')} />
          </View>
          <View ref={register('carburant')} collapsable={false} style={{ flex: 1 }}>
            <SelectField label={label('carburant')} value={draft.carburant} aiRead={ai('carburant')} options={optionList(FUEL_TYPES, 'fuel')} searchable={false} onChange={(value) => set('carburant', value as FuelType)} />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>{t('vehicleForm.edit.sections.documents')}</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DocumentSlot label={t('vehicleForm.edit.docs.recto')} uri={uriOf('recto')} readCount={faces.recto ? slotCount : undefined} onScan={() => setCamera('recto')} onView={() => uriOf('recto') && setViewer({ uri: uriOf('recto') as string, label: t('vehicleForm.edit.docs.recto') })} onReplace={() => setCamera('recto')} onRemove={faces.recto ? () => setFaces((previous) => ({ ...previous, recto: null })) : undefined} />
            <DocumentSlot label={t('vehicleForm.edit.docs.verso')} hint={uriOf('verso') ? undefined : t('vehicleForm.edit.docs.versoHint')} uri={uriOf('verso')} readCount={faces.verso ? slotCount : undefined} onScan={() => setCamera('verso')} onView={() => uriOf('verso') && setViewer({ uri: uriOf('verso') as string, label: t('vehicleForm.edit.docs.verso') })} onReplace={() => setCamera('verso')} onRemove={faces.verso ? () => setFaces((previous) => ({ ...previous, verso: null })) : undefined} />
          </View>
          {problem ? (
            <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1.5, borderColor: Palette.error, backgroundColor: Brand.errorFieldFill, padding: 12 }}>
              <Ionicons name="alert-circle-outline" size={16} color={Palette.error} />
              <HText weight="semibold" size={13} color={Palette.error} style={{ flex: 1 }}>
                {`${t(problem.reason === 'too_small' ? 'vehicleForm.edit.scan.tooSmall' : 'vehicleForm.edit.scan.unreadable')}`}
              </HText>
              <Pressable onPress={() => setCamera(problem.face)} accessibilityRole="button" accessibilityLabel={t('vehicleForm.edit.scan.retake')} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' }}>
                <HText weight="bold" size={13} color={Palette.error}>
                  {t('vehicleForm.edit.scan.retake')}
                </HText>
              </Pressable>
            </View>
          ) : null}
          <DocumentList rows={[docRow('assurance', insuranceStatus, insuranceThumb), docRow('visite_technique', visitStatus, visitThumb)]} />
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>{t('vehicleForm.edit.sections.deadlines')}</SectionLabel>
          {nextDue ? (
            <Panel gap={12}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <HText weight="semibold" size={14}>
                    {nextDue.name}
                  </HText>
                  <HText size={12} color={Palette.textSecondary}>
                    {`${dateText(nextDue.date)} · ${toDisplayDate(nextDue.date)}`}
                  </HText>
                </View>
                <View style={{ borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: nextDue.state === 'valid' ? Palette.successSoft : nextDue.state === 'expired' ? Palette.errorSoft : Brand.aiBadgeFill }}>
                  <HText weight="bold" size={11} color={nextDue.state === 'valid' ? Palette.success : nextDue.state === 'expired' ? Palette.error : Brand.orangeUrgentText}>
                    {t(nextDue.state === 'valid' ? 'vehicleForm.edit.due.upToDate' : nextDue.state === 'expired' ? 'vehicleForm.edit.due.late' : 'vehicleForm.edit.due.soon')}
                  </HText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[{ label: t('vehicleForm.edit.due.addOil'), onPress: () => setOilSheet(true) }, { label: t('vehicleForm.edit.due.addVisit'), onPress: () => router.push({ pathname: '/flotte/[id]', params: { id: vehicle.id } }) }].map((chip) => (
                  <Pressable key={chip.label} onPress={chip.onPress} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                    <View style={{ height: 36, borderRadius: 18, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface, paddingHorizontal: 12, justifyContent: 'center' }}>
                      <HText weight="semibold" size={12}>
                        {chip.label}
                      </HText>
                    </View>
                  </Pressable>
                ))}
              </View>
            </Panel>
          ) : (
            <EmptyState icon="construct-outline" title={t('vehicleForm.edit.due.emptyTitle')} text={t('vehicleForm.edit.due.emptyText')} chips={[{ label: t('vehicleForm.edit.due.addOil'), onPress: () => setOilSheet(true) }, { label: t('vehicleForm.edit.due.addVisit'), onPress: () => router.push({ pathname: '/flotte/[id]', params: { id: vehicle.id } }) }, { label: t('vehicleForm.edit.due.addInsurance'), onPress: () => router.push({ pathname: '/flotte/[id]', params: { id: vehicle.id } }) }]} />
          )}
        </View>

        <View style={{ gap: 12 }}>
          <SectionLabel>{t('vehicleForm.edit.sections.identity')}</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View ref={register('marque')} collapsable={false} style={{ flex: 1 }}>
              <FormField label={label('marque')} value={draft.marque} onChangeText={(value) => set('marque', value)} placeholder={t('vehicleForm.edit.ph.marque')} aiRead={ai('marque')} error={message('marque')} showError={submitted} autoCapitalize="words" />
            </View>
            <View ref={register('modele')} collapsable={false} style={{ flex: 1 }}>
              <FormField label={label('modele')} value={draft.modele} onChangeText={(value) => set('modele', value)} placeholder={t('vehicleForm.edit.ph.modele')} aiRead={ai('modele')} error={message('modele')} showError={submitted} autoCapitalize="words" />
            </View>
          </View>
          <View ref={register('immatriculation')} collapsable={false}>
            <FormField ltr label={label('immatriculation')} value={draft.immatriculation} onChangeText={(value) => set('immatriculation', value)} placeholder={t('vehicleForm.edit.ph.immatriculation')} aiRead={ai('immatriculation')} error={message('immatriculation')} showError={submitted} />
          </View>
          <View ref={register('vin')} collapsable={false}>
            <FormField ltr label={label('vin')} value={draft.vin} onChangeText={(value) => set('vin', value.toUpperCase())} placeholder={t('vehicleForm.edit.ph.vin')} help={t('vehicleForm.edit.help.vin')} aiRead={ai('vin')} autoCapitalize="characters" />
          </View>
          <FormField label={label('finition')} value={draft.finition} onChangeText={(value) => set('finition', value)} placeholder={t('vehicleForm.edit.ph.finition')} aiRead={ai('finition')} />
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View ref={register('annee')} collapsable={false} style={{ flex: 1 }}>
              <FormField label={label('annee')} value={draft.annee} onChangeText={(value) => set('annee', value.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder={t('vehicleForm.edit.ph.annee')} aiRead={ai('annee')} error={message('annee')} showError={submitted} />
            </View>
            <View ref={register('niveauCarburant')} collapsable={false} style={{ flex: 1 }}>
              <FormField label={label('niveauCarburant')} value={draft.niveauCarburant} onChangeText={(value) => set('niveauCarburant', value.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" unit={t('vehicleForm.edit.units.percent')} placeholder={t('vehicleForm.edit.ph.niveauCarburant')} help={t('vehicleForm.edit.help.niveauCarburant')} error={message('niveauCarburant')} showError={submitted} />
            </View>
          </View>
          <View ref={register('dateMiseEnCirculation')} collapsable={false}>
            <DateField label={label('dateMiseEnCirculation')} value={draft.dateMiseEnCirculation} onChange={(value) => set('dateMiseEnCirculation', value)} maximumDate={new Date()} error={message('dateMiseEnCirculation')} showError={submitted} />
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <SectionLabel>{t('vehicleForm.edit.sections.availability')}</SectionLabel>
          <ChoiceTiles<VehicleStatus> label={label('statut')} value={draft.statut} onChange={chooseStatus} options={MANUAL_VEHICLE_STATUSES.map((value) => ({ value, label: t(`vehicleForm.edit.status.${value}`), icon: STATUS_ICON[value] ?? 'ellipse-outline' }))} />
          {statusMessage ? (
            <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8, borderRadius: 14, borderWidth: 1.5, borderColor: Palette.error, backgroundColor: Brand.errorFieldFill, padding: 12 }}>
              <Ionicons name="alert-circle-outline" size={16} color={Palette.error} />
              <HText weight="semibold" size={13} color={Palette.error} style={{ flex: 1 }}>
                {statusMessage}
              </HText>
            </View>
          ) : null}
          {canChooseBranch ? <SelectField label={label('branchId')} value={draft.branchId ?? ''} options={[{ value: '', label: t('vehicle.fields.allBranches') }, ...branches.map((branch) => ({ value: branch.id, label: branch.nom }))]} searchable={false} onChange={(value) => set('branchId', value === '' ? null : value)} /> : null}
        </View>

        <View style={{ gap: 12 }}>
          <SectionLabel>{t('vehicleForm.edit.sections.description')}</SectionLabel>
          <FormField label={label('description')} value={draft.description} onChangeText={(value) => set('description', value)} placeholder={t('vehicleForm.edit.ph.description')} multiline />
        </View>

        {showPrices ? (
          <View style={{ gap: 12 }}>
            <SectionLabel>{t('vehicleForm.edit.sections.pricing')}</SectionLabel>
            <View ref={register('prixJour')} collapsable={false} style={{ gap: 6 }}>
              <PriceStepper
                label={label('prixJour')}
                value={draft.prixJour}
                onChange={(value) => set('prixJour', value)}
                suggestions={week ? [{ label: t('form.suggestWeek', { price: formatAmount(week.week), pct: week.weekPct }), onPress: () => set('prixSemaine', String(week.week)) }, { label: t('form.suggestMonth', { price: formatAmount(week.month), pct: week.monthPct }), onPress: () => set('prixMois', String(week.month)) }] : undefined}
              />
              <InlineError message={message('prixJour')} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View ref={register('prixSemaine')} collapsable={false} style={{ flex: 1 }}>
                <FormField label={label('prixSemaine')} value={draft.prixSemaine} onChangeText={(value) => set('prixSemaine', value)} thousands unit={t('vehicleForm.edit.units.mad')} placeholder={t('vehicleForm.edit.ph.prixSemaine')} error={message('prixSemaine')} showError={submitted} />
              </View>
              <View ref={register('prixMois')} collapsable={false} style={{ flex: 1 }}>
                <FormField label={label('prixMois')} value={draft.prixMois} onChangeText={(value) => set('prixMois', value)} thousands unit={t('vehicleForm.edit.units.mad')} placeholder={t('vehicleForm.edit.ph.prixMois')} error={message('prixMois')} showError={submitted} />
              </View>
            </View>
          </View>
        ) : null}

        {isManager ? <DangerLink label={t('vehicleForm.edit.archive.link')} onPress={confirmArchive} disabled={!!block} reason={block ? archiveReasonText(block, t, language, now) : undefined} /> : null}
      </ScrollView>

      {saveError ? (
        <View style={{ position: 'absolute', start: 16, end: 16, bottom: insets.bottom + 100 + keyboard }}>
          <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: Brand.errorFieldFill, borderWidth: 1.5, borderColor: Palette.error, padding: 12 }}>
            <Ionicons name="alert-circle" size={16} color={Palette.error} />
            <HText weight="semibold" size={13} color={Palette.error} style={{ flex: 1 }}>
              {saveError}
            </HText>
          </View>
        </View>
      ) : null}

      <SaveBar changes={dirty ? changeLabels : []} onSave={() => void save()} onCancel={cancel} busy={saving} />

      <CameraCapture visible={camera !== null} onClose={() => setCamera(null)} onCapture={(uri) => camera && void onCaptured(camera, uri)} hint={t('vehicleForm.edit.scan.hint')} />
      <AddOilSheet vehicleId={vehicle.id} visible={oilSheet} onClose={() => setOilSheet(false)} />
      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          {viewer ? <Image source={{ uri: viewer.uri }} accessibilityLabel={viewer.label} style={{ width: '100%', height: '75%' }} resizeMode="contain" /> : null}
          <Pressable onPress={() => setViewer(null)} accessibilityRole="button" accessibilityLabel={t('vehicleForm.edit.viewerClose')} style={{ marginTop: 16, minHeight: 48, paddingHorizontal: 24, borderRadius: 24, backgroundColor: Brand.white, justifyContent: 'center' }}>
            <HText weight="semibold">{t('form.close')}</HText>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
