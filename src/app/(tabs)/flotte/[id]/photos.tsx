import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useMyAgency } from '@/features/agency/hooks';
import { deleteVehiclePhotoFile, uploadVehiclePhotoWithAngle } from '@/features/vehicles/api';
import { displayName } from '@/features/vehicles/detail/names';
import { MoreMenu } from '@/features/vehicles/detail/sheets';
import { useUpdateVehiclePhotos, useVehicle } from '@/features/vehicles/hooks';
import { addPhoto, angleSlots, canAddMore, filledAngles, isMainPhoto, makeMain, movePhoto, otherPhotos, photoRights, removePhoto, replacePhoto } from '@/features/vehicles/photos/logic';
import { ActionButton, AngleIcon, PhotoImage, SlotTile } from '@/features/vehicles/photos/views';
import type { PhotoAngle, VehiclePhoto } from '@/features/vehicles/types';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

type Selection = { angle: PhotoAngle; path: string | null };
type Pending = { uri: string; angle: PhotoAngle; replacePath: string | null };

async function pick(source: 'camera' | 'library'): Promise<string | null | 'denied'> {
  const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return 'denied';
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync({ quality: 0.9 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/** Écran Photos : angles conseillés, photo principale, remplacer, supprimer, déplacer (appui long). L'employé ne peut qu'ajouter. */
export default function VehiclePhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const vehicleQuery = useVehicle(id);
  const agency = useMyAgency();
  const updatePhotos = useUpdateVehiclePhotos();
  const vehicle = vehicleQuery.data;
  const rights = photoRights(agency.data?.role);
  const [selection, setSelection] = useState<Selection>({ angle: 'avant', path: null });
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [fraction, setFraction] = useState(0);
  const [failed, setFailed] = useState(false);

  if (vehicleQuery.isLoading || !vehicle) {
    return (
      <View style={{ flex: 1, backgroundColor: Brand.photoScreenBackground, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <StatusBar style="light" />
        {vehicleQuery.isError ? <HText color={Brand.textOnDark}>{t('vehiclePhotos.loadError')}</HText> : <ActivityIndicator color={Brand.orange} />}
      </View>
    );
  }

  const photos = vehicle.photos;
  const name = displayName(vehicle);
  const slots = angleSlots(photos);
  const others = otherPhotos(photos);
  const selectedPhoto = selection.path ? (photos.find((photo) => photo.path === selection.path) ?? null) : (slots.find((slot) => slot.angle === selection.angle)?.photo ?? null);
  const selectedIsMain = !!selectedPhoto && isMainPhoto(photos, selectedPhoto.path);
  const busy = pending !== null && !failed;
  const positionOf = (photo: VehiclePhoto) => photos.indexOf(photo) + 1;
  const filled = filledAngles(photos);
  const countLabel = photos.length === 0 ? t('vehiclePhotos.countNone') : t(photos.length === 1 ? 'vehiclePhotos.countOne' : 'vehiclePhotos.countMany', { count: photos.length, angles: filled });
  const angleLabel = (angle: PhotoAngle) => t(`vehiclePhotos.angleLabel.${angle}`);

  async function save(next: VehiclePhoto[]) {
    try {
      await updatePhotos.mutateAsync({ id: vehicle!.id, photos: next });
      return true;
    } catch {
      Alert.alert(t('common.appName'), t('vehiclePhotos.saveError'));
      return false;
    }
  }

  async function upload(job: Pending) {
    if (!agency.data) return;
    // Contrôles avant l'envoi : on n'envoie rien qui sera refusé (12 max, angle déjà pris).
    if (!job.replacePath) {
      const check = addPhoto(photos, { path: 'x', uploadedAt: '', angle: job.angle });
      if (!check.ok) return Alert.alert(t('common.appName'), t(check.reason === 'full' ? 'vehiclePhotos.full' : 'vehiclePhotos.angleTaken'));
    }
    setPending(job);
    setFailed(false);
    setFraction(0);
    try {
      const uploaded = await uploadVehiclePhotoWithAngle(agency.data.agencyId, vehicle!.id, job.uri, job.angle, setFraction);
      const next = job.replacePath ? replacePhoto(photos, job.replacePath, uploaded) : addPhoto(photos, uploaded);
      const list = Array.isArray(next) ? next : next.ok ? next.photos : null;
      if (!list) throw new Error('rejected');
      await updatePhotos.mutateAsync({ id: vehicle!.id, photos: list });
      if (job.replacePath && rights.canManage) void deleteVehiclePhotoFile(job.replacePath).catch(() => undefined);
      setSelection({ angle: job.angle, path: job.angle === 'autre' ? uploaded.path : null });
      setPending(null);
    } catch {
      setFailed(true);
    }
  }

  /** Remplacer : on demande d'où vient la nouvelle photo. */
  function chooseSource(angle: PhotoAngle, replacePath: string) {
    Alert.alert(t('vehiclePhotos.replace'), undefined, [
      { text: t('vehiclePhotos.take'), onPress: () => void start('camera', angle, replacePath) },
      { text: t('vehiclePhotos.gallery'), onPress: () => void start('library', angle, replacePath) },
      { text: t('vehiclePhotos.cancel'), style: 'cancel' },
    ]);
  }

  async function start(source: 'camera' | 'library', angle: PhotoAngle, replacePath: string | null = null) {
    const uri = await pick(source);
    if (uri === 'denied') return Alert.alert(t('common.appName'), t('vehiclePhotos.permission'));
    if (uri) void upload({ uri, angle, replacePath });
  }

  function confirmRemove(photo: VehiclePhoto) {
    const main = isMainPhoto(photos, photo.path);
    Alert.alert(t('vehiclePhotos.deleteTitle'), main && photos.length > 1 ? t('vehiclePhotos.deleteBodyMain') : t('vehiclePhotos.deleteBody'), [
      { text: t('vehiclePhotos.cancel'), style: 'cancel' },
      {
        text: t('vehiclePhotos.remove'),
        style: 'destructive',
        onPress: async () => {
          if (await save(removePhoto(photos, photo.path))) {
            void deleteVehiclePhotoFile(photo.path).catch(() => undefined);
            setSelection({ angle: photo.angle ?? 'autre', path: null });
          }
        },
      },
    ]);
  }

  const menuPhoto = menuPath ? (photos.find((photo) => photo.path === menuPath) ?? null) : null;
  const menuIndex = menuPhoto ? photos.indexOf(menuPhoto) : -1;
  const menuItems =
    menuPhoto && rights.canManage
      ? [
          ...(menuIndex > 0 ? [{ key: 'main', label: t('vehiclePhotos.makeMain'), onPress: () => void save(makeMain(photos, menuPhoto.path)) }] : []),
          ...(menuIndex > 0 ? [{ key: 'earlier', label: t('vehiclePhotos.moveEarlier'), onPress: () => void save(movePhoto(photos, menuPhoto.path, -1)) }] : []),
          ...(menuIndex < photos.length - 1 ? [{ key: 'later', label: t('vehiclePhotos.moveLater'), onPress: () => void save(movePhoto(photos, menuPhoto.path, 1)) }] : []),
          { key: 'replace', label: t('vehiclePhotos.replace'), onPress: () => chooseSource(menuPhoto.angle ?? 'autre', menuPhoto.path) },
          { key: 'remove', label: t('vehiclePhotos.remove'), onPress: () => confirmRemove(menuPhoto), danger: true },
        ]
      : [];

  const longPress = (photo: VehiclePhoto | null) => (photo && rights.canManage ? () => setMenuPath(photo.path) : undefined);
  const roundButton = { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Brand.strokeOnDark, backgroundColor: Brand.surfaceOnDark, alignItems: 'center', justifyContent: 'center' } as const;

  return (
    <View style={{ flex: 1, backgroundColor: Brand.photoScreenBackground }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(`/flotte/${vehicle.id}`))} accessibilityRole="button" accessibilityLabel={t('vehiclePhotos.back')} style={roundButton}>
            <Ionicons name={isRTL(language) ? 'chevron-forward' : 'chevron-back'} size={18} color={Brand.white} />
          </Pressable>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <HText font="display" weight="bold" size={16} color={Brand.white} accessibilityRole="header">
              {t('vehiclePhotos.title')}
            </HText>
            <HText size={11} color={Brand.mutedOnDark}>
              {countLabel}
            </HText>
          </View>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(`/flotte/${vehicle.id}`))} accessibilityRole="button" accessibilityLabel={t('vehiclePhotos.ok')} style={{ height: 44, borderRadius: 22, paddingHorizontal: 16, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
            <HText weight="semibold" size={13} color={Brand.white}>
              {t('vehiclePhotos.ok')}
            </HText>
          </Pressable>
        </View>

        <View style={{ height: 250, borderRadius: 24, overflow: 'hidden', backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.panelStrokeOnDark, marginTop: 8 }}>
          {selectedPhoto ? (
            <PhotoImage photo={selectedPhoto} label={t('vehicleDetail.photoAlt', { angle: t(`vehicleDetail.angles.${selectedPhoto.angle ?? 'autre'}`), name })} style={{ width: '100%', height: 250 }} />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <AngleIcon angle={selection.angle} size={56} />
              <HText size={13} color={Brand.mutedOnDark}>
                {t('vehiclePhotos.empty', { angle: angleLabel(selection.angle) })}
              </HText>
            </View>
          )}
          <View style={{ position: 'absolute', start: 12, top: 12, flexDirection: 'row', gap: 6 }}>
            <HText weight="bold" size={11} color={Brand.white} style={{ backgroundColor: 'rgba(32,37,39,0.85)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' }}>
              {angleLabel(selectedPhoto?.angle ?? selection.angle)}
            </HText>
            {selectedIsMain ? (
              <HText weight="bold" size={11} color={Brand.graphite} style={{ backgroundColor: Brand.warningOnDark, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' }}>
                {t('vehiclePhotos.main')}
              </HText>
            ) : null}
          </View>
          {pending ? (
            <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, padding: 14, gap: 8, backgroundColor: 'rgba(22,26,27,0.92)' }}>
              <HText size={13} color={Brand.white} weight="semibold">
                {failed ? t('vehiclePhotos.uploadError') : t('vehiclePhotos.uploading', { percent: Math.round(fraction * 100) })}
              </HText>
              {failed ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={() => void upload(pending)} accessibilityRole="button" accessibilityLabel={t('vehiclePhotos.retry')} style={{ minHeight: 44, borderRadius: 22, paddingHorizontal: 18, backgroundColor: Brand.orange, justifyContent: 'center' }}>
                    <HText weight="semibold" size={13} color={Brand.white}>
                      {t('vehiclePhotos.retry')}
                    </HText>
                  </Pressable>
                  <Pressable onPress={() => setPending(null)} accessibilityRole="button" accessibilityLabel={t('vehiclePhotos.cancel')} style={{ minHeight: 44, borderRadius: 22, paddingHorizontal: 18, borderWidth: 1, borderColor: Brand.strokeOnDark, justifyContent: 'center' }}>
                    <HText weight="semibold" size={13} color={Brand.white}>
                      {t('vehiclePhotos.cancel')}
                    </HText>
                  </Pressable>
                </View>
              ) : (
                <View style={{ height: 6, borderRadius: 3, backgroundColor: Brand.strokeOnDark, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.round(fraction * 100)}%`, height: 6, backgroundColor: Brand.orange }} />
                </View>
              )}
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {selectedPhoto ? (
            rights.canManage ? (
              <>
                <ActionButton icon="star-outline" tone={selectedIsMain ? 'main' : 'neutral'} disabled={selectedIsMain || busy} label={selectedIsMain ? t('vehiclePhotos.isMain') : t('vehiclePhotos.makeMain')} onPress={() => void save(makeMain(photos, selectedPhoto.path))} />
                <ActionButton icon="refresh-outline" disabled={busy} label={t('vehiclePhotos.replace')} onPress={() => chooseSource(selectedPhoto.angle ?? 'autre', selectedPhoto.path)} />
                <ActionButton icon="trash-outline" tone="danger" disabled={busy} label={t('vehiclePhotos.remove')} onPress={() => confirmRemove(selectedPhoto)} />
              </>
            ) : (
              <HText size={12} color={Brand.mutedOnDark} style={{ flex: 1, lineHeight: 18 }}>
                {t('vehiclePhotos.employeeNote')}
              </HText>
            )
          ) : rights.canAdd ? (
            <>
              <Pressable
                onPress={() => void start('camera', selection.angle)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t('vehiclePhotos.take')}
                accessibilityState={{ disabled: busy }}
                style={{ flex: 2, height: 64, borderRadius: 16, backgroundColor: Brand.orange, opacity: busy ? 0.5 : 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Ionicons name="camera-outline" size={20} color={Brand.white} />
                <HText weight="semibold" size={14} color={Brand.white}>
                  {t('vehiclePhotos.take')}
                </HText>
              </Pressable>
              <ActionButton icon="images-outline" disabled={busy} label={t('vehiclePhotos.gallery')} onPress={() => void start('library', selection.angle)} />
            </>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
          <HText weight="semibold" size={11} track={0.16} color={Brand.mutedOnDark}>
            {t('vehiclePhotos.recommended').toLocaleUpperCase()}
          </HText>
          {rights.canManage ? (
            <HText size={11} color={Brand.mutedOnDark}>
              {t('vehiclePhotos.holdHint')}
            </HText>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {slots.map((slot) => (
            <SlotTile
              key={slot.angle}
              angle={slot.angle}
              photo={slot.photo}
              position={slot.photo ? positionOf(slot.photo) : null}
              main={!!slot.photo && isMainPhoto(photos, slot.photo.path)}
              selected={!selection.path && selection.angle === slot.angle}
              onPress={() => setSelection({ angle: slot.angle, path: null })}
              onLongPress={longPress(slot.photo)}
            />
          ))}
        </View>

        {others.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {others.map((photo) => (
              <SlotTile
                key={photo.path}
                angle="autre"
                photo={photo}
                position={positionOf(photo)}
                main={isMainPhoto(photos, photo.path)}
                selected={selection.path === photo.path}
                onPress={() => setSelection({ angle: 'autre', path: photo.path })}
                onLongPress={longPress(photo)}
              />
            ))}
          </View>
        ) : null}

        {rights.canAdd ? (
          <Pressable
            onPress={() => (canAddMore(photos) ? void start('camera', 'autre') : Alert.alert(t('common.appName'), t('vehiclePhotos.full')))}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('vehiclePhotos.other')}
            accessibilityState={{ disabled: busy || !canAddMore(photos) }}
            style={{ height: 52, borderRadius: 26, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Brand.slotDashOnDark, opacity: canAddMore(photos) ? 1 : 0.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Ionicons name="add" size={18} color={Brand.textOnDark} />
            <HText weight="semibold" size={14} color={Brand.textOnDark}>
              {t('vehiclePhotos.other')}
            </HText>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 16, backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.panelStrokeOnDark }}>
          <Ionicons name="star" size={16} color={Brand.warningOnDark} style={{ marginTop: 1 }} />
          <HText size={12} color={Brand.mutedOnDark} style={{ flex: 1, lineHeight: 18 }}>
            {t('vehiclePhotos.info')}
          </HText>
        </View>
      </ScrollView>
      <MoreMenu visible={menuPhoto !== null && menuItems.length > 0} onClose={() => setMenuPath(null)} items={menuItems} />
    </View>
  );
}
