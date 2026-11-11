import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Brand, Palette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { ArrowIcon, HText, MicroLabel } from '@/features/dashboard/home-ui';
import { AddHeader, BackButton } from '@/features/vehicles/add/add-ui';
import { findExistingVehicle } from '@/features/vehicles/add/lookup';
import { PlateDisplay } from '@/features/vehicles/add/plate-display';
import { ConfirmCard, FieldEditor, ReviewRow } from '@/features/vehicles/add/review-parts';
import { buildReview, confirmField, initialReviewState, pendingFields, readCount, REVIEW_GROUPS, validateReviewValue, type ReviewKey, type ReviewState } from '@/features/vehicles/add/review';
import { draftFromReview, getScanSession } from '@/features/vehicles/add/scan-session';
import { setVehicleCreationDraft } from '@/features/vehicles/creation-draft';
import { useReactivateVehicle, useVehicles } from '@/features/vehicles/hooks';
import { withAlpha } from '@/features/vehicles/fleet-style';
import { VehicleImage, vehicleName } from '@/features/vehicles/vehicle-image';
import { plateText } from '@/features/vehicles/fleet-card';
import { useLanguage } from '@/i18n/use-language';

function Counter({ value, label, tone }: { value: string; label: string; tone: 'normal' | 'alert' | 'good' }) {
  return (
    <View style={{ flex: 1, borderRadius: 16, padding: 12, gap: 4, backgroundColor: tone === 'alert' ? Brand.orangeDeep : withAlpha(Brand.surfaceOnDark, 0.9), borderWidth: 1, borderColor: tone === 'alert' ? Brand.orange : Brand.strokeOnDark }}>
      <HText font="display" weight="bold" size={22} color={tone === 'good' ? Brand.successOnDark : Brand.white} style={{ lineHeight: 26 }}>
        {value}
      </HText>
      <MicroLabel size={10} track={0.1} color={Brand.mutedOnDark}>
        {label}
      </MicroLabel>
    </View>
  );
}

/**
 * Carte grise lue : l'employé vérifie ce qui a été lu. Les infos douteuses passent en premier (« à confirmer ») avec la valeur lue, les
 * caractères invalides soulignés et la correction évidente pré-remplie ; le doublon éventuel bloque la suite et propose d'ouvrir sa fiche.
 */
export default function CarteLueScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const session = getScanSession();
  const vehiclesQuery = useVehicles();
  const role = useMyAgency().data?.role;
  const reactivate = useReactivateVehicle();
  const fields = useMemo(() => (session ? buildReview(session.merged) : []), [session]);
  const [state, setState] = useState<ReviewState>(() => initialReviewState(fields));
  const [editing, setEditing] = useState<ReviewKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editIssue, setEditIssue] = useState<ReturnType<typeof validateReviewValue>>(null);

  if (!session) return <Redirect href="/flotte/nouveau" />;

  const labelOf = (key: ReviewKey) => t(`vehicleAdd.read.labels.${key}`);
  const pending = pendingFields(fields, state);
  const duplicate = findExistingVehicle(vehiclesQuery.data ?? [], { plate: state.immatriculation.value, vin: state.vin.value });
  const fieldOf = (key: ReviewKey) => fields.find((field) => field.key === key)!;
  const seconds = Math.max(1, Math.round(session.durationMs / 1000));
  const fuel = state.carburant.value ? t(`vehicle.fuel.${state.carburant.value}`) : '';
  const year = state.dateMiseEnCirculation.value.slice(-4);
  const name = `${state.marque.value} ${state.modele.value}`.trim() || t('vehicleAdd.read.nothingRead');

  function confirm(key: ReviewKey, value: string) {
    const result = confirmField(state, key, value);
    setState(result.state);
    if (!result.issue) void Haptics.selectionAsync().catch(() => undefined);
    return result.issue;
  }

  function startEdit(key: ReviewKey) {
    if (editing === key) {
      setEditing(null);
      return;
    }
    setEditing(key);
    setEditValue(state[key].value);
    setEditIssue(null);
  }

  function submitEdit(key: ReviewKey) {
    const issue = confirm(key, editValue);
    setEditIssue(issue);
    if (!issue) setEditing(null);
  }

  function next() {
    if (pending.length > 0 || duplicate) return;
    setVehicleCreationDraft(draftFromReview(session!, state));
    router.replace('/flotte/nouveau/finaliser');
  }

  function openDuplicate() {
    if (duplicate) router.push(`/flotte/${duplicate.vehicle.id}`);
  }

  function handleReactivate() {
    if (!duplicate) return;
    reactivate.mutate(duplicate.vehicle.id, { onSuccess: openDuplicate, onError: () => Alert.alert(t('common.appName'), t('vehicleAdd.read.reactivateError')) });
  }

  const faces = (['recto', 'verso'] as const).filter((face) => session.photos[face]);
  const canReactivate = !!duplicate?.archived && (role === 'owner' || role === 'manager');
  const cta = pending.length > 0 ? t('vehicleAdd.read.ctaConfirmFirst', { field: t(`vehicleAdd.read.ctaFields.${pending[0]}`) }) : duplicate ? t('vehicleAdd.read.ctaDuplicate') : t('vehicleAdd.read.ctaGo');
  const ctaReady = pending.length === 0 && !duplicate;

  return (
    <ThemedView className="flex-1" style={{ backgroundColor: Palette.surface }}>
      <StatusBar style="light" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <AddHeader radius={36} glow>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <BackButton onPress={() => router.replace('/flotte/nouveau/scan')} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.successOnDark, shadowColor: Brand.successOnDark, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }} />
              <HText weight="semibold" size={12} color={Brand.successOnDark}>
                {session.fromCache ? t('vehicleAdd.read.readInstant') : t('vehicleAdd.read.readIn', { n: seconds })}
              </HText>
            </View>
          </View>

          {/* Les faces lues, en miniature, inclinées, avec une coche verte au centre */}
          <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {faces.map((face, index) => (
              <View key={face} style={{ position: 'absolute', width: 150, height: 96, borderRadius: 10, overflow: 'hidden', backgroundColor: Brand.textOnDark, transform: [{ translateX: faces.length === 1 ? 0 : index === 0 ? -57 : 57 }, { translateY: index === 0 ? 4 : -2 }, { rotate: index === 0 ? '-8deg' : '6deg' }], shadowColor: Palette.shadow, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 10 } }}>
                <Image source={{ uri: session.photos[face] as string }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </View>
            ))}
            <View style={{ position: 'absolute', top: 76, width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.success, borderWidth: 3, borderColor: Brand.graphite, alignItems: 'center', justifyContent: 'center', shadowColor: Brand.successOnDark, shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }}>
              <Ionicons name="checkmark" size={20} color={Brand.white} />
            </View>
          </View>

          <View style={{ alignItems: 'center', gap: 12 }}>
            <PlateDisplay plate={state.immatriculation.value} />
            <HText font="display" weight="bold" size={24} color={Brand.white} style={{ textAlign: 'center', lineHeight: 30 }} accessibilityRole="header">
              {name}
            </HText>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[fuel, state.puissanceFiscale.value ? t('vehicleAdd.read.fieldCv', { n: state.puissanceFiscale.value }) : '', /^\d{4}$/.test(year) ? year : ''].filter(Boolean).map((chip) => (
                <View key={chip} style={{ backgroundColor: Brand.borderOnDark, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <HText weight="semibold" size={12} color={Brand.textOnDark}>
                    {chip}
                  </HText>
                </View>
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Counter value={String(readCount(fields))} label={t('vehicleAdd.read.fieldsRead')} tone="normal" />
            <Counter value={String(pending.length)} label={t('vehicleAdd.read.toCheck')} tone={pending.length > 0 ? 'alert' : 'normal'} />
            <Counter value={duplicate ? '1' : '0'} label={t('vehicleAdd.read.duplicate')} tone={duplicate ? 'alert' : 'good'} />
          </View>
        </AddHeader>

        <View style={{ padding: 20, gap: 14 }}>
          {pending.map((key, index) => (
            <ConfirmCard
              key={key}
              field={fieldOf(key)}
              label={labelOf(key)}
              headline={index === 0 ? (pending.length === 1 ? t('vehicleAdd.read.toConfirmOne') : t('vehicleAdd.read.toConfirmMany', { count: pending.length })) : null}
              onConfirm={(value) => confirm(key, value)}
            />
          ))}

          {duplicate ? (
            <View style={{ backgroundColor: Palette.warningSoft, borderWidth: 1, borderColor: Brand.parcInspect, borderRadius: 18, padding: 14, gap: 12 }} accessibilityLiveRegion="polite">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="alert-circle" size={22} color={Palette.warning} />
                <View style={{ flex: 1, gap: 2 }}>
                  <HText weight="bold" size={14} color={Palette.warning}>
                    {t('vehicleAdd.read.dupTitle')}
                  </HText>
                  <HText size={13} color={Palette.warning}>
                    {t(duplicate.field === 'vin' ? 'vehicleAdd.read.dupVin' : 'vehicleAdd.read.dupPlate') + (duplicate.archived ? t('vehicleAdd.read.dupArchived') : '')}
                  </HText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Palette.card, borderRadius: 14, padding: 8 }}>
                <VehicleImage vehicle={duplicate.vehicle} width={84} height={62} radius={12} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <HText font="display" weight="bold" size={15} numberOfLines={1}>
                    {vehicleName(duplicate.vehicle)}
                  </HText>
                  <HText weight="bold" size={12} style={{ writingDirection: 'ltr' }}>
                    {plateText(duplicate.vehicle.immatriculation)}
                  </HText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Pressable onPress={openDuplicate} accessibilityRole="button" style={{ minHeight: 44, flexGrow: 1, borderRadius: 22, backgroundColor: Brand.graphite, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16 }}>
                  <HText weight="semibold" size={14} color={Brand.white}>
                    {t('vehicleAdd.read.openFile')}
                  </HText>
                  <ArrowIcon color={Brand.white} size={15} />
                </Pressable>
                {canReactivate ? (
                  <Pressable onPress={handleReactivate} accessibilityRole="button" style={{ minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: Palette.warning, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
                    <HText weight="semibold" size={14} color={Palette.warning}>
                      {t('vehicleAdd.read.reactivate')}
                    </HText>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Palette.successSoft, borderWidth: 1, borderColor: Palette.success, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 }}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Palette.success} />
              <HText size={13} color={Palette.success} style={{ flex: 1, lineHeight: 18 }}>
                <HText size={13} weight="bold" color={Palette.success}>
                  {t('vehicleAdd.read.newVehicle')}
                </HText>
                {t('vehicleAdd.read.newVehicleBody')}
              </HText>
            </View>
          )}

          {REVIEW_GROUPS.map((group) => (
            <View key={group.key} style={{ backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 22, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={group.key === 'vehicle' ? 'car-outline' : group.key === 'technical' ? 'settings-outline' : 'document-text-outline'} size={15} color={Brand.white} />
                </View>
                <MicroLabel size={11} track={0.14}>
                  {t(`vehicleAdd.read.groups.${group.key}`)}
                </MicroLabel>
              </View>
              {group.fields.map((key) => {
                const field = fieldOf(key);
                const value = state[key].value;
                const display = key === 'carburant' ? (value ? t(`vehicle.fuel.${value}`) : '') : key === 'puissanceFiscale' && value ? t('vehicleAdd.read.fieldCv', { n: value }) : key === 'immatriculation' ? plateText(value) : value;
                return (
                  <ReviewRow
                    key={key}
                    label={key === 'dateMiseEnCirculation' ? t('vehicleAdd.read.rowLabels.dateMiseEnCirculation') : labelOf(key)}
                    display={display}
                    confirmed={state[key].confirmed}
                    uncertain={field.uncertain}
                    onPress={() => startEdit(key)}
                    editor={
                      editing === key ? (
                        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: key === 'carburant' ? 'wrap' : 'nowrap' }}>
                            <FieldEditor fieldKey={key} value={editValue} onChange={(next) => { setEditValue(next); setEditIssue(null); }} onSubmit={() => submitEdit(key)} issue={editIssue} autoFocus={key !== 'carburant'} />
                            <Pressable onPress={() => submitEdit(key)} accessibilityRole="button" accessibilityLabel={t('vehicleAdd.read.ok')} style={{ minHeight: 48, minWidth: 64, borderRadius: 24, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
                              <HText weight="semibold" size={14} color={Brand.white}>
                                {t('vehicleAdd.read.ok')}
                              </HText>
                            </Pressable>
                          </View>
                          {editIssue ? (
                            <HText size={12} color={Palette.error} accessibilityLiveRegion="polite">
                              {t(`vehicleAdd.read.reasons.${editIssue}`)}
                            </HText>
                          ) : null}
                        </View>
                      ) : null
                    }
                  />
                );
              })}
            </View>
          ))}

          <HText size={11} color={Palette.textSecondary} style={{ textAlign: 'center', lineHeight: 16, paddingHorizontal: 10 }}>
            {t(session.keepPhoto ? 'vehicleAdd.read.hint' : 'vehicleAdd.read.hintNoPhoto')}
          </HText>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingTop: 14, paddingHorizontal: 20, paddingBottom: insets.bottom + 14, backgroundColor: Palette.card, borderTopWidth: 1, borderTopColor: Palette.border, shadowColor: Palette.shadow, shadowOpacity: 0.06, shadowRadius: 15, shadowOffset: { width: 0, height: -10 } }}>
        <Pressable onPress={() => router.replace('/flotte/nouveau/scan')} accessibilityRole="button" accessibilityLabel={t('vehicleAdd.read.retakeA11y')} style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="refresh" size={20} color={Palette.textPrimary} />
        </Pressable>
        <Pressable
          onPress={next}
          disabled={!ctaReady}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ctaReady }}
          style={{ flex: 1, minHeight: 54, borderRadius: 27, backgroundColor: ctaReady ? Brand.orange : Palette.textSecondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, ...(ctaReady ? { shadowColor: Brand.orange, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } } : {}) }}
        >
          <HText weight="semibold" size={15} color={Brand.white} numberOfLines={1} style={{ flexShrink: 1 }}>
            {cta}
          </HText>
          {ctaReady ? <ArrowIcon color={Brand.white} size={16} /> : null}
        </Pressable>
      </View>
    </ThemedView>
  );
}
