import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CollapsibleSection } from '@/components/collapsible-section';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ZoomableImage } from '@/components/zoomable-image';
import { M3akPalette } from '@/constants/theme';
import { useInspectionPermissions } from '@/features/inspections/permissions';
import { useLanguage } from '@/i18n/use-language';

import { analysisErrorMessageKey } from './analysis-api';
import { DamageCard } from './damage-card';
import { DamageEditor, parseCost, type DamageDraft } from './damage-editor';
import { countDamages, pendingNewDamages, sortDamages } from './damages';
import {
  useAnalyzeInspection,
  useDeclineAnalysis,
  useResumeInspection,
  useCreateManualDamage,
  useInspectionDamages,
  useInspectionForRental,
  useInspectionPhotos,
  usePhotoSignedUrl,
  useUpdateDamage,
} from './hooks';
import { InspectionReportSection } from './inspection-report-section';
import type { InspectionType, PhotoAngle } from './types';

type Props = { rentalId: string; agencyId: string; type: InspectionType };

function PairPhoto({ path, label }: { path?: string; label: string }) {
  const { t } = useLanguage();
  const { data: url } = usePhotoSignedUrl(path);
  return (
    <View className="flex-1 gap-1">
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
        {label}
      </ThemedText>
      <View style={{ height: 110 }}>
        {url ? (
          <ZoomableImage uri={url} label={label} style={{ borderRadius: 12 }} />
        ) : (
          <View className="flex-1 items-center justify-center rounded-xl bg-[#FAF9FF]">
            {path ? <ActivityIndicator color={M3akPalette.mauve} /> : <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, textAlign: 'center' }}>{t('inspection.analysis.compare.noDepart')}</ThemedText>}
          </View>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[30%] flex-1 gap-0.5 rounded-2xl bg-[#FAF9FF] px-3 py-2">
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

/**
 * Après la prise des photos, l'employé DÉCIDE : faire analyser les photos par M3ak (puis relire chaque dommage proposé :
 * confirmer, rejeter, corriger, choisir de l'inscrire au contrat ou non), ou décliner l'analyse (les photos restent
 * stockées pour l'inspection et la comparaison au retour, et il écrit lui-même les dommages éventuels). Dans les deux
 * cas il peut ajouter à la main un dommage que l'IA n'a pas vu.
 * Au retour, les dommages nouveaux et confirmés alimentent la retenue sur caution et le rapport.
 */
export function InspectionAnalysisScreen({ rentalId, agencyId, type }: Props) {
  const { t } = useLanguage();
  const inspectionQuery = useInspectionForRental(rentalId, type);
  const inspection = inspectionQuery.data;
  const departQuery = useInspectionForRental(rentalId, 'depart');
  const photosQuery = useInspectionPhotos(inspection?.id);
  const departPhotosQuery = useInspectionPhotos(type === 'retour' ? departQuery.data?.id : undefined);
  const damagesQuery = useInspectionDamages(inspection?.id);
  const analyze = useAnalyzeInspection(rentalId, type);
  const decline = useDeclineAnalysis(rentalId, type);
  const permissions = useInspectionPermissions(agencyId);
  const resume = useResumeInspection(rentalId, type);
  const updateDamage = useUpdateDamage(inspection?.id ?? '');
  const createDamage = useCreateManualDamage(inspection?.id ?? '', agencyId);
  const [skipAi, setSkipAi] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const photos = photosQuery.data ?? [];
  const departPhotos = departPhotosQuery.data ?? [];
  const damages = damagesQuery.data ?? [];
  const hasDepart = type === 'retour' && departPhotos.length > 0;

  const running = analyze.isPending;
  const skipped = !!inspection?.skipped;
  const failed = !skipAi && !skipped && (analyze.isError || inspection?.analysisStatus === 'echec');
  const analyzed = inspection && (inspection.analysisStatus === 'terminee' || inspection.analysisStatus === 'partielle');
  // Photos prises mais l'employé n'a pas encore choisi : analyser avec M3ak, ou non ?
  const undecided = !!inspection && !skipped && inspection.analysisStatus === 'aucune' && photos.length > 0 && photosQuery.isSuccess;
  const declined = inspection?.analysisStatus === 'refusee';
  const manualMode = !!inspection && !skipped && !running && !failed && !analyzed && !undecided;

  function relaunch() {
    if (!inspection) return;
    const run = () => analyze.mutate(inspection.id);
    if (damages.some((damage) => damage.source === 'ia' && damage.statut !== 'propose')) {
      Alert.alert(t('inspection.analysis.relaunchTitle'), t('inspection.analysis.relaunchBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('inspection.analysis.relaunchConfirm'), onPress: run },
      ]);
    } else {
      run();
    }
  }

  async function handleAdd(draft: DamageDraft) {
    setAddError(null);
    try {
      await createDamage.mutateAsync({
        zone: draft.zone,
        type: draft.type,
        gravite: draft.gravite,
        nouveau: type === 'retour' ? draft.nouveau : false,
        description: draft.description.trim() || null,
        cout: parseCost(draft.cost) ?? 0,
        angle: null,
        photoId: null,
      });
      setAdding(false);
    } catch {
      setAddError(t('inspection.analysis.damages.saveError'));
    }
  }

  const counts = countDamages(damages);
  const ordered = (() => {
    const sorted = sortDamages(damages);
    return [...sorted.filter((damage) => damage.statut !== 'rejete'), ...sorted.filter((damage) => damage.statut === 'rejete')];
  })();
  const photoPathById = new Map(photos.map((photo) => [photo.id, photo.url]));
  const pending = pendingNewDamages(damages);
  const failedZones = inspection?.failedZones ?? [];
  const newAddDraft: DamageDraft = { zone: 'autre', type: 'rayure', gravite: 'leger', nouveau: type === 'retour', cost: '', description: '' };

  const pairs = hasDepart
    ? photos.map((photo) => ({ angle: photo.angle as PhotoAngle, retour: photo.url, depart: departPhotos.find((d) => d.angle === photo.angle)?.url }))
    : [];

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t(`inspection.analysis.title.${type}`)} showBack />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-12" keyboardShouldPersistTaps="handled">
          {!inspection || photosQuery.isLoading ? <ActivityIndicator color={M3akPalette.mauve} /> : null}

          {skipped && inspection ? (
            <Card className="gap-3">
              <ThemedText type="smallBold">{t('inspection.decision.skippedTitle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('inspection.decision.skippedBody')}
              </ThemedText>
              <Button label={t('locations.journey.skip.doItAnyway')} variant="secondary" loading={resume.isPending} onPress={() => resume.mutate(inspection.id, { onSuccess: () => router.replace({ pathname: type === 'depart' ? '/locations/[id]/inspection-depart' : '/locations/[id]/inspection-retour', params: { id: rentalId } }) })} />
              <Button label={t('inspection.analysis.inspectionDone')} onPress={() => router.back()} />
            </Card>
          ) : null}

          {undecided && inspection && !running ? (
            <Card className="gap-4">
              <ThemedText type="subtitle">{t('inspection.decision.title')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('inspection.decision.body', { count: photos.length })}
              </ThemedText>
              <Button label={t('inspection.decision.yes')} icon="sparkles-outline" onPress={() => analyze.mutate(inspection.id)} />
              {permissions.canDecline ? (
                <>
                  <Button label={t('inspection.decision.no')} variant="secondary" loading={decline.isPending} onPress={() => decline.mutate(inspection.id)} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('inspection.decision.noHint')}
                  </ThemedText>
                </>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('inspection.decision.mandatory')}
                </ThemedText>
              )}
            </Card>
          ) : null}

          {running ? (
            <Card className="items-center gap-3 py-8">
              <ActivityIndicator color={M3akPalette.mauve} size="large" />
              <ThemedText type="smallBold">{t('inspection.analysis.running')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" className="text-center">
                {t('inspection.analysis.runningHint')}
              </ThemedText>
            </Card>
          ) : null}

          {failed && !running ? (
            <Card className="gap-3">
              <ThemedText type="smallBold">{t(analyze.isError ? analysisErrorMessageKey(analyze.error) : 'inspection.analysis.errors.failed')}</ThemedText>
              <View className="flex-row gap-2">
                <Button label={t('inspection.analysis.relaunch')} size="sm" style={{ flex: 1 }} onPress={relaunch} />
                <Button label={t('inspection.analysis.continueWithout')} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setSkipAi(true)} />
              </View>
            </Card>
          ) : null}

          {inspection && !running && (analyzed || manualMode) ? (
            <>
              {declined ? (
                <Card className="gap-2">
                  <ThemedText type="smallBold">{t('inspection.decision.declinedTitle')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('inspection.decision.declinedBody', { count: photos.length })}
                  </ThemedText>
                  <Button
                    label={t('inspection.decision.analyzeAnyway')}
                    variant="secondary"
                    onPress={() => analyze.mutate(inspection.id)}
                  />
                </Card>
              ) : null}

              {analyzed ? (
                <Card className="gap-3">
                  <ThemedText type="subtitle" style={{ color: type === 'retour' && counts.nouveaux > 0 ? '#B91C1C' : '#15803D' }}>
                    {type === 'retour'
                      ? counts.nouveaux > 0
                        ? t('inspection.analysis.summary.new', { count: counts.nouveaux })
                        : t('inspection.analysis.summary.none')
                      : counts.total > 0
                        ? t('inspection.analysis.summary.departCount', { count: counts.total })
                        : t('inspection.analysis.summary.departNone')}
                  </ThemedText>
                  <View className="flex-row flex-wrap gap-2">
                    {type === 'retour' && counts.existants > 0 ? <Stat label={t('inspection.analysis.damages.existing')} value={String(counts.existants)} /> : null}
                    {counts.aVerifier > 0 ? <Stat label={t('inspection.analysis.damages.toCheck')} value={String(counts.aVerifier)} /> : null}
                    {inspection.kilometrage !== null ? <Stat label={t('inspection.analysis.readings.km')} value={t('inspection.analysis.readings.kmValue', { km: inspection.kilometrage })} /> : null}
                    {inspection.niveauCarburant !== null ? <Stat label={t('inspection.analysis.readings.fuel')} value={t('inspection.analysis.readings.fuelValue', { percent: inspection.niveauCarburant })} /> : null}
                    {inspection.proprete ? <Stat label={t('inspection.analysis.readings.cleanliness')} value={t(`inspection.analysis.readings.clean.${inspection.proprete}`)} /> : null}
                  </View>
                  {inspection.aiSummary ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {inspection.aiSummary}
                    </ThemedText>
                  ) : null}
                  {type === 'retour' && !hasDepart ? (
                    <ThemedText type="small" style={{ color: '#B45309' }}>
                      {t('inspection.analysis.summary.notCompared')}
                    </ThemedText>
                  ) : null}
                  {failedZones.length > 0 ? (
                    <ThemedText type="small" style={{ color: '#B45309' }}>
                      {t('inspection.analysis.partial', { zones: failedZones.map((zone) => t(`inspection.analysis.zones.${zone}`)).join(', ') })}
                    </ThemedText>
                  ) : null}
                </Card>
              ) : null}

              {pairs.length > 0 ? (
                <CollapsibleSection title={t('inspection.analysis.compare.title')} badge={String(pairs.length)}>
                  <View className="gap-3">
                    {pairs.map((pair) => (
                      <View key={pair.angle} className="gap-1">
                        <ThemedText type="smallBold">{t(`inspection.angles.${pair.angle}`)}</ThemedText>
                        <View className="flex-row gap-2">
                          <PairPhoto path={pair.depart} label={t('inspection.analysis.compare.depart')} />
                          <PairPhoto path={pair.retour} label={t('inspection.analysis.compare.retour')} />
                        </View>
                      </View>
                    ))}
                  </View>
                </CollapsibleSection>
              ) : null}

              <View className="gap-3">
                <ThemedText type="smallBold">{`${t('inspection.analysis.damages.title')} (${counts.total})`}</ThemedText>
                {damagesQuery.isLoading ? <ActivityIndicator color={M3akPalette.mauve} /> : null}
                {!damagesQuery.isLoading && ordered.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('inspection.analysis.damages.empty')}
                  </ThemedText>
                ) : null}
                {ordered.map((damage, index) => (
                  <DamageCard
                    key={damage.id}
                    damage={damage}
                    index={index + 1}
                    photoPath={damage.photoId ? photoPathById.get(damage.photoId) : undefined}
                    canChooseNew={type === 'retour'}
                    canChooseContract={type === 'depart'}
                    onPatch={(patch) => updateDamage.mutateAsync({ id: damage.id, patch })}
                  />
                ))}

                {adding ? (
                  <Card>
                    <DamageEditor
                      initial={newAddDraft}
                      canChooseNew={type === 'retour'}
                      saving={createDamage.isPending}
                      error={addError}
                      saveLabel={t('inspection.analysis.damages.add')}
                      onCancel={() => setAdding(false)}
                      onSave={handleAdd}
                    />
                  </Card>
                ) : (
                  <Button label={t('inspection.analysis.damages.add')} variant="secondary" icon="add-circle-outline" onPress={() => setAdding(true)} />
                )}
              </View>

              {type === 'retour' && pending.length > 0 ? (
                <ThemedText type="small" style={{ color: '#B45309' }}>
                  {t('inspection.analysis.summary.pendingDecision', { count: pending.length })}
                </ThemedText>
              ) : null}

              {type === 'retour' ? (
                <InspectionReportSection rentalId={rentalId} damages={damages} pendingCount={pending.length} inspection={inspection} />
              ) : null}

              {inspection.analysisStatus !== 'aucune' && photos.length > 0 ? (
                <Button label={t('inspection.analysis.relaunch')} variant="ghost" onPress={relaunch} />
              ) : null}
              <Button label={t('inspection.analysis.inspectionDone')} onPress={() => router.back()} />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
