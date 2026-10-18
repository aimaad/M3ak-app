import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChipGroup } from '@/components/chip-group';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useSignedUrl } from '@/features/storage/hooks';
import { useLanguage } from '@/i18n/use-language';

import { AGENCY_ASSETS_BUCKET } from './api';
import { useRemoveAgencyStamp, useSaveAgencyStampConfig, useUploadAgencyStamp } from './hooks';
import { defaultStampConfig, parseStampConfig, stampSvg, STAMP_COLORS, STAMP_LIMITS, STAMP_SHAPES, type StampColor, type StampConfig, type StampShape } from './stamp';
import type { AgencyDetails } from './types';

const sameConfig = (a: StampConfig | null, b: StampConfig | null) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Cachet de l'agence : un vrai tampon dessiné par M3ak (rond, rectangulaire ou ovale ; nom en arc, lignes au centre, ville),
 * aperçu en direct. On peut aussi utiliser la photo de son cachet physique à la place.
 * Le parent donne une `key` qui change avec le cachet enregistré : les réglages repartent alors de celui-ci.
 */
export function AgencyStampSettings({ agencyId, isOwner, details }: { agencyId: string; isOwner: boolean; details: AgencyDetails }) {
  const { t } = useLanguage();
  const saveConfig = useSaveAgencyStampConfig();
  const uploadStamp = useUploadAgencyStamp();
  const removeStamp = useRemoveAgencyStamp();
  const { data: photoUrl } = useSignedUrl(AGENCY_ASSETS_BUCKET, details.stampPath ?? undefined);

  const initial = useMemo(() => details.stampConfig ?? defaultStampConfig(details), [details]);
  const [shape, setShape] = useState<StampShape>(initial.shape);
  const [color, setColor] = useState<StampColor>(initial.color);
  const [title, setTitle] = useState(initial.title);
  const [address, setAddress] = useState(initial.address);
  const [tel, setTel] = useState(initial.tel);
  const [gsm, setGsm] = useState(initial.gsm);

  const draft = parseStampConfig({ v: 1, shape, color, title, address, tel, gsm });
  const hasPhoto = !!details.stampPath;
  const saved = !!details.stampConfig;
  const dirty = !!draft && !sameConfig(draft, details.stampConfig);
  const previewConfig = draft ?? initial;
  const xml = useMemo(() => stampSvg(previewConfig, 170), [previewConfig]);

  async function pickPhoto(source: 'library' | 'camera') {
    const permission = source === 'library' ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result =
      source === 'library' ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 }) : await ImagePicker.launchCameraAsync({ quality: 0.8 });
    const uri = result.canceled ? null : result.assets[0]?.uri;
    if (!uri) return;
    try {
      await uploadStamp.mutateAsync({ agencyId, localUri: uri });
    } catch {
      Alert.alert(t('common.appName'), t('entreprise.stamp.error'));
    }
  }

  async function handleSave() {
    if (!draft) return;
    try {
      await saveConfig.mutateAsync({ agencyId, config: draft });
    } catch {
      Alert.alert(t('common.appName'), t('entreprise.stamp.error'));
    }
  }

  return (
    <View className="gap-2">
      <ThemedText type="smallBold">{t('entreprise.stamp.title')}</ThemedText>
      <Card className="gap-4">
        {hasPhoto ? (
          <View className="items-center gap-2">
            {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: 150, height: 150 }} resizeMode="contain" /> : <ThemedText type="small" themeColor="textSecondary">{t('entreprise.stamp.loading')}</ThemedText>}
            <ThemedText type="small" themeColor="textSecondary" className="text-center">
              {t('entreprise.stamp.photoActive')}
            </ThemedText>
          </View>
        ) : (
          <View className="items-center gap-1 rounded-2xl bg-white py-3" style={{ borderWidth: 1, borderColor: '#EAE5F2' }}>
            <SvgXml xml={xml} width={170} height={Number(/height="(\d+)"/.exec(xml)?.[1] ?? 170)} />
            <ThemedText type="small" themeColor="textSecondary">
              {saved ? t('entreprise.stamp.saved') : t('entreprise.stamp.notSaved')}
            </ThemedText>
          </View>
        )}

        {isOwner ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {t('entreprise.stamp.generatedHelp')}
            </ThemedText>
            <View className="gap-1.5">
              <ThemedText type="small" themeColor="textSecondary">{t('entreprise.stamp.shape')}</ThemedText>
              <ChipGroup<StampShape> options={STAMP_SHAPES} selected={shape} getLabel={(value) => t(`entreprise.stamp.shapes.${value}`)} onSelect={setShape} />
            </View>
            <View className="gap-1.5">
              <ThemedText type="small" themeColor="textSecondary">{t('entreprise.stamp.color')}</ThemedText>
              <ChipGroup<StampColor> options={STAMP_COLORS} selected={color} getLabel={(value) => t(`entreprise.stamp.colors.${value}`)} onSelect={setColor} />
            </View>
            <TextField label={t('entreprise.stamp.titleLabel')} value={title} onChangeText={setTitle} maxLength={STAMP_LIMITS.title} autoCapitalize="characters" error={!title.trim() ? t('vehicle.form.errors.required') : undefined} />
            <TextField label={t('entreprise.stamp.addressLabel')} value={address} onChangeText={setAddress} maxLength={STAMP_LIMITS.address} placeholder={t('entreprise.stamp.addressPlaceholder')} />
            <TextField label={t('entreprise.stamp.telLabel')} value={tel} onChangeText={setTel} maxLength={STAMP_LIMITS.phone} keyboardType="phone-pad" />
            <TextField label={t('entreprise.stamp.gsmLabel')} value={gsm} onChangeText={setGsm} maxLength={STAMP_LIMITS.phone} keyboardType="phone-pad" />
            <Button
              label={saved && !dirty && !hasPhoto ? t('entreprise.stamp.upToDate') : hasPhoto ? t('entreprise.stamp.useGenerated') : t('entreprise.stamp.save')}
              onPress={handleSave}
              loading={saveConfig.isPending}
              disabled={!draft || (!dirty && !hasPhoto) || saveConfig.isPending}
            />

            <View className="gap-2 border-t border-[#EAE5F2] pt-3">
              <ThemedText type="small" themeColor="textSecondary">{t('entreprise.stamp.photoHelp')}</ThemedText>
              <View className="flex-row flex-wrap gap-2">
                <Button label={t('common.camera')} variant="secondary" size="sm" disabled={uploadStamp.isPending} onPress={() => pickPhoto('camera')} />
                <Button label={t('common.gallery')} variant="secondary" size="sm" disabled={uploadStamp.isPending} onPress={() => pickPhoto('library')} />
                {hasPhoto || saved ? (
                  <Button
                    label={t('entreprise.stamp.remove')}
                    variant="ghost"
                    size="sm"
                    disabled={removeStamp.isPending}
                    onPress={() => removeStamp.mutate(agencyId, { onError: () => Alert.alert(t('common.appName'), t('entreprise.stamp.error')) })}
                  />
                ) : null}
              </View>
            </View>
          </>
        ) : null}
      </Card>
    </View>
  );
}
