import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLanguage } from '@/i18n/use-language';

import { computeAngleProgress } from './angle-progress';
import { useCompleteInspection, useCreateInspection, useInspectionForRental, useInspectionPhotos } from './hooks';
import { persistCapturedPhoto } from './local-photo-storage';
import { CAPTURE_ANGLES, type InspectionType, type PhotoAngle } from './types';
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
  const photosQuery = useInspectionPhotos(inspectionQuery.data?.id);
  const { pendingPhotos, isSyncing, syncNow, addPending } = usePhotoSync(
    inspectionQuery.data?.id,
    agencyId
  );

  const [manualAngle, setManualAngle] = useState<PhotoAngle | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!inspectionQuery.isLoading && !inspectionQuery.data && !createInspection.isPending) {
      createInspection.mutate({ agencyId, rentalId, vehicleId, type });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionQuery.isLoading, inspectionQuery.data]);

  const uploadedAngles = (photosQuery.data ?? []).map((photo) => photo.angle);
  const pendingAngles = pendingPhotos.map((photo) => photo.angle);
  const coveredAngles = Array.from(new Set([...uploadedAngles, ...pendingAngles]));
  const progress = computeAngleProgress(coveredAngles);
  const activeAngle = manualAngle ?? progress.nextAngle;

  const inspection = inspectionQuery.data;

  async function handleCapture() {
    if (!inspection || !activeAngle || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      if (!photo) return;
      const localUri = persistCapturedPhoto(photo.uri, `${activeAngle}-${Date.now()}.jpg`);
      await addPending({
        id: `${inspection.id}-${activeAngle}-${Date.now()}`,
        inspectionId: inspection.id,
        agencyId,
        angle: activeAngle,
        localUri,
        createdAt: new Date().toISOString(),
      });
      setManualAngle(null);
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleFinish() {
    if (!inspection) return;
    await completeInspection.mutateAsync(inspection.id);
    router.back();
  }

  if (!permission) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator color="#1f5eff" />
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
          <Pressable onPress={requestPermission} className="rounded-2xl bg-[#1f5eff] px-5 py-3">
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
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <View className="bg-white">
          <ScreenHeader
            title={t(`inspection.title.${type}`)}
            subtitle={t('inspection.progress', { done: progress.capturedAngles.length, total: CAPTURE_ANGLES.length })}
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
            <View className="absolute inset-x-0 top-4 items-center">
              <View className="rounded-full bg-black/60 px-4 py-2">
                <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                  {t('inspection.angleRequired', { angle: t(`inspection.angles.${activeAngle}`) })}
                </ThemedText>
              </View>
            </View>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {CAPTURE_ANGLES.map((angle) => {
              const done = progress.capturedAngles.includes(angle);
              const selected = angle === activeAngle;
              return (
                <Pressable
                  key={angle}
                  onPress={() => setManualAngle(angle)}
                  className={`rounded-full border px-3 py-1.5 ${
                    selected
                      ? 'border-[#1f5eff] bg-[#1f5eff]'
                      : done
                        ? 'border-[#15803d] bg-[#e7f7ec]'
                        : 'border-[#e1e5f0] bg-white'
                  }`}
                >
                  <ThemedText
                    type="small"
                    style={{ color: selected ? '#ffffff' : done ? '#15803d' : '#101423' }}
                  >
                    {`${done ? '✓ ' : ''}${t(`inspection.angles.${angle}`)}`}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          {progress.isComplete ? (
            <Pressable
              onPress={handleFinish}
              disabled={completeInspection.isPending}
              className="items-center rounded-2xl bg-[#1f5eff] px-4 py-4"
            >
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                {t('inspection.finish')}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleCapture}
              disabled={!inspection || isCapturing}
              className="h-16 w-16 self-center items-center justify-center rounded-full border-4 border-[#1f5eff] bg-white"
            >
              {isCapturing ? <ActivityIndicator color="#1f5eff" /> : <View className="h-11 w-11 rounded-full bg-[#1f5eff]" />}
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
