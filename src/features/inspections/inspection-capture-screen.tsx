import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useInspectionPermissions } from '@/features/inspections/permissions';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLanguage } from '@/i18n/use-language';

import { computeAngleProgress } from './angle-progress';
import {
  useCompleteInspection,
  useCreateInspection,
  useInspectionForRental,
  useInspectionPhotos,
  useResumeInspection,
  useSkipInspection,
} from './hooks';
import { persistCapturedPhoto } from './local-photo-storage';
import { CAPTURE_ANGLES, CAPTURE_PLAN, isSkippableAngle, type InspectionType, type PhotoAngle } from './types';
import { usePhotoSync } from './use-photo-sync';

type InspectionCaptureScreenProps = {
  rentalId: string;
  vehicleId: string;
  agencyId: string;
  type: InspectionType;
};

export function InspectionCaptureScreen({
  rentalId,
  vehicleId,
  agencyId,
  type,
}: InspectionCaptureScreenProps) {
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const inspectionQuery = useInspectionForRental(rentalId, type);
  const createInspection = useCreateInspection();
  const completeInspection = useCompleteInspection();
  const skipInspection = useSkipInspection(rentalId, type);
  const permissions = useInspectionPermissions(agencyId);
  const resumeInspection = useResumeInspection(rentalId, type);
  const photosQuery = useInspectionPhotos(inspectionQuery.data?.id);
  const { pendingPhotos, isSyncing, syncNow, addPending } = usePhotoSync(
    inspectionQuery.data?.id,
    agencyId
  );

  const [manualAngle, setManualAngle] = useState<PhotoAngle | null>(null);
  const [skipped, setSkipped] = useState<PhotoAngle[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!inspectionQuery.isLoading && !inspectionQuery.data && !createInspection.isPending) {
      createInspection.mutate({ agencyId, rentalId, vehicleId, type });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionQuery.isLoading, inspectionQuery.data]);

  // On revient prendre les photos d'une inspection qui avait été ignorée : elle redevient « à faire ».
  useEffect(() => {
    if (inspectionQuery.data?.skipped && !resumeInspection.isPending) resumeInspection.mutate(inspectionQuery.data.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionQuery.data?.skipped]);

  const uploadedAngles = (photosQuery.data ?? []).map((photo) => photo.angle);
  const pendingAngles = pendingPhotos.map((photo) => photo.angle);
  const coveredAngles = Array.from(new Set([...uploadedAngles, ...pendingAngles]));
  const progress = computeAngleProgress([...coveredAngles, ...skipped]);
  const activeAngle = manualAngle ?? progress.nextAngle;

  const inspection = inspectionQuery.data;

  async function handleCapture() {
    if (!inspection || !activeAngle || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (!photo) return;
      // Photo réduite (1600 px) : assez nette pour voir une rayure, assez légère pour l'envoi et pour l'analyse IA.
      const resized = await ImageManipulator.manipulateAsync(photo.uri, [{ resize: photo.width >= photo.height ? { width: 1600 } : { height: 1600 } }], {
        compress: 0.75,
        format: ImageManipulator.SaveFormat.JPEG,
      }).catch(() => null);
      const localUri = persistCapturedPhoto(resized?.uri ?? photo.uri, `${activeAngle}-${Date.now()}.jpg`);
      await addPending({
        id: `${inspection.id}-${activeAngle}-${Date.now()}`,
        inspectionId: inspection.id,
        agencyId,
        angle: activeAngle,
        localUri,
        createdAt: new Date().toISOString(),
      });
      setSkipped((prev) => prev.filter((angle) => angle !== activeAngle));
      setManualAngle(null);
    } finally {
      setIsCapturing(false);
    }
  }

  /** Ignorer toute l'inspection (aucune photo) : seulement tant qu'aucune photo n'a été prise. */
  function handleSkipInspection() {
    Alert.alert(t('locations.journey.skip.title'), t('locations.journey.skip.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('locations.journey.skip.confirm'),
        style: 'destructive',
        onPress: () => skipInspection.mutate({ agencyId, vehicleId }, { onSuccess: () => router.back() }),
      },
    ]);
  }

  function handleSkip() {
    if (!activeAngle) return;
    Alert.alert(t('inspection.skipTitle'), t('inspection.skipBody', { angle: t(`inspection.angles.${activeAngle}`) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('inspection.skipConfirm'),
        onPress: () => {
          setSkipped((prev) => [...prev, activeAngle]);
          setManualAngle(null);
        },
      },
    ]);
  }

  async function handleFinish() {
    if (!inspection) return;
    // Les photos en attente d'envoi partent d'abord : l'analyse IA se fait sur les photos déjà dans le nuage.
    if (pendingPhotos.length > 0) {
      await syncNow();
    }
    await completeInspection.mutateAsync(inspection.id);
    router.replace({ pathname: '/locations/[id]/inspection-analyse', params: { id: rentalId, type } });
  }

  if (!permission) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator color="#7C3AED" />
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1 items-center justify-center gap-4 px-8" edges={['top', 'left', 'right']}>
          <ThemedText type="default" themeColor="textSecondary" className="text-center">
            {t('inspection.permissionRequired')}
          </ThemedText>
          <Pressable onPress={requestPermission} className="rounded-2xl bg-[#7C3AED] px-5 py-3">
            <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
              {t('inspection.grantPermission')}
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1 bg-black">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <View className="bg-white">
          <ScreenHeader
            title={t(`inspection.title.${type}`)}
            subtitle={t('inspection.progress', { done: coveredAngles.filter((angle) => CAPTURE_ANGLES.includes(angle)).length, total: CAPTURE_ANGLES.length })}
            showBack
          />
        </View>

        <View className="flex-1">
          {inspection ? (
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
          ) : (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#ffffff" />
              <ThemedText type="small" style={{ color: '#ffffff' }} className="mt-2">
                {t('inspection.starting')}
              </ThemedText>
            </View>
          )}

          {activeAngle ? (
            <View className="absolute inset-x-3 top-3 items-center gap-2">
              <View className="rounded-full bg-black/60 px-4 py-2">
                <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                  {t('inspection.angleRequired', { angle: t(`inspection.angles.${activeAngle}`) })}
                </ThemedText>
              </View>
              <View className="rounded-2xl bg-black/60 px-4 py-2">
                <ThemedText type="small" style={{ color: '#ffffff', textAlign: 'center' }}>
                  {t(`inspection.angleHints.${activeAngle}`)}
                </ThemedText>
              </View>
            </View>
          ) : null}

          {coveredAngles.length === 0 && inspection && permissions.canSkip ? (
            <Pressable
              onPress={handleSkipInspection}
              disabled={skipInspection.isPending}
              className="absolute bottom-4 self-center rounded-full bg-black/60 px-4 py-2"
              style={{ alignSelf: 'center' }}
            >
              <ThemedText type="small" style={{ color: '#ffffff' }}>
                {t('locations.journey.skip.action')}
              </ThemedText>
            </Pressable>
          ) : null}

          {pendingPhotos.length > 0 ? (
            <Pressable
              onPress={() => syncNow()}
              className="absolute bottom-4 left-4 right-4 flex-row items-center justify-center gap-2 rounded-full bg-black/60 px-4 py-2"
            >
              {isSyncing ? <ActivityIndicator color="#ffffff" size="small" /> : null}
              <ThemedText type="small" style={{ color: '#ffffff' }}>
                {t('inspection.pendingUpload', { count: pendingPhotos.length })}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        <View className="gap-3 bg-white px-4 pb-4 pt-3">
          <View className="flex-row gap-2">
            {CAPTURE_PLAN.map((entry) => {
              const done = entry.angles.filter((angle) => coveredAngles.includes(angle)).length;
              return (
                <View key={entry.group} className="flex-1 rounded-xl bg-[#FAF9FF] px-2 py-1.5">
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                    {t(`inspection.groups.${entry.group}`)}
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: done === entry.angles.length ? '#15803D' : '#211A2E' }}>
                    {done}/{entry.angles.length}
                  </ThemedText>
                </View>
              );
            })}
          </View>
          <ScrollView horizontal className="grow-0 shrink-0" showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {CAPTURE_ANGLES.map((angle) => {
              const done = coveredAngles.includes(angle);
              const selected = angle === activeAngle;
              return (
                <Pressable
                  key={angle}
                  onPress={() => setManualAngle(angle)}
                  className={`rounded-full border px-3 py-1.5 ${
                    selected
                      ? 'border-[#7C3AED] bg-[#7C3AED]'
                      : done
                        ? 'border-[#15803D] bg-[#DCFCE7]'
                        : 'border-[#E4DCF5] bg-white'
                  }`}
                >
                  <ThemedText
                    type="small"
                    style={{ color: selected ? '#ffffff' : done ? '#15803D' : '#211A2E' }}
                  >
                    {`${done ? '✓ ' : skipped.includes(angle) ? '– ' : ''}${t(`inspection.angles.${angle}`)}`}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          {progress.isComplete ? (
            <Pressable
              onPress={handleFinish}
              disabled={completeInspection.isPending}
              className="items-center rounded-2xl bg-[#7C3AED] px-4 py-4"
            >
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                {t('inspection.finish')}
              </ThemedText>
            </Pressable>
          ) : (
            <View className="flex-row items-center justify-between">
              {activeAngle && isSkippableAngle(activeAngle) ? (
                <Pressable onPress={handleSkip} hitSlop={8} className="w-24">
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('inspection.skip')}
                  </ThemedText>
                </Pressable>
              ) : (
                <View className="w-24" />
              )}
              <Pressable
                onPress={handleCapture}
                disabled={!inspection || isCapturing}
                className="h-16 w-16 items-center justify-center rounded-full border-4 border-[#7C3AED] bg-white"
              >
                {isCapturing ? <ActivityIndicator color="#7C3AED" /> : <View className="h-11 w-11 rounded-full bg-[#7C3AED]" />}
              </Pressable>
              <View className="w-24" />
            </View>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
