import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { KeepPhotoChoice } from '@/components/keep-photo-choice';
import { ChipGroup } from '@/components/chip-group';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { setVehicleCreationDraft } from '@/features/vehicles/creation-draft';
import { scanErrorMessageKey } from '@/features/ocr/availability';
import { useOcrSettings } from '@/features/ocr/hooks';
import { OcrInactiveNotice } from '@/features/ocr/ocr-inactive-notice';
import { scanVehicleDocument, type OcrConfidence, type ScanErrorCode, type VehicleOcrFields } from '@/features/vehicles/ocr';
import { FUEL_TYPES, VEHICLE_CATEGORIES, type FuelType, type VehicleCategory } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

type Status = 'idle' | 'processing' | 'result' | 'error';

type EditableFields = {
  immatriculation: string;
  vin: string;
  marque: string;
  modele: string;
  finition: string;
  annee: string;
  couleur: string;
  nombrePlaces: string;
  carburant: FuelType | null;
  categorie: VehicleCategory | null;
};

const EMPTY_EDITABLE: EditableFields = {
  immatriculation: '',
  vin: '',
  marque: '',
  modele: '',
  finition: '',
  annee: '',
  couleur: '',
  nombrePlaces: '',
  carburant: null,
  categorie: null,
};

function fieldsToEditable(fields: VehicleOcrFields): EditableFields {
  return {
    immatriculation: fields.immatriculation.value ?? '',
    vin: fields.vin.value ?? '',
    marque: fields.marque.value ?? '',
    modele: fields.modele.value ?? '',
    finition: fields.finition.value ?? '',
    annee: fields.annee.value != null ? String(fields.annee.value) : '',
    couleur: fields.couleur.value ?? '',
    nombrePlaces: fields.nombrePlaces.value != null ? String(fields.nombrePlaces.value) : '',
    carburant: fields.carburant.value,
    categorie: fields.categorie.value,
  };
}

async function pickImage(source: 'library' | 'camera'): Promise<string | null> {
  const permission =
    source === 'library'
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result =
    source === 'library'
      ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchCameraAsync({ quality: 0.8 });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

export default function ScannerCarteGriseScreen() {
  const { t } = useLanguage();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorCode, setErrorCode] = useState<ScanErrorCode | null>(null);
  const [keepPhoto, setKeepPhoto] = useState(true);
  const { availability } = useOcrSettings();
  const [confidences, setConfidences] = useState<Partial<Record<keyof EditableFields, OcrConfidence>>>({});
  const [values, setValues] = useState<EditableFields>(EMPTY_EDITABLE);

  function update<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePick(source: 'library' | 'camera') {
    const uri = await pickImage(source);
    if (!uri) return;
    setLocalUri(uri);
    setStatus('processing');
    setErrorCode(null);

    const result = await scanVehicleDocument(uri);
    if (!result.ok) {
      setErrorCode(result.error);
      setStatus('error');
      return;
    }

    setValues(fieldsToEditable(result.fields));
    setConfidences({
      immatriculation: result.fields.immatriculation.confidence,
      vin: result.fields.vin.confidence,
      marque: result.fields.marque.confidence,
      modele: result.fields.modele.confidence,
      finition: result.fields.finition.confidence,
      annee: result.fields.annee.confidence,
      couleur: result.fields.couleur.confidence,
      nombrePlaces: result.fields.nombrePlaces.confidence,
      carburant: result.fields.carburant.confidence,
      categorie: result.fields.categorie.confidence,
    });
    setStatus('result');
  }

  function continueWithDraft(useValues: boolean) {
    setVehicleCreationDraft({
      immatriculation: useValues && values.immatriculation.trim() ? values.immatriculation.trim() : undefined,
      vin: useValues && values.vin.trim() ? values.vin.trim() : undefined,
      marque: useValues && values.marque.trim() ? values.marque.trim() : undefined,
      modele: useValues && values.modele.trim() ? values.modele.trim() : undefined,
      finition: useValues && values.finition.trim() ? values.finition.trim() : undefined,
      annee: useValues && values.annee.trim() ? Number(values.annee) : undefined,
      couleur: useValues && values.couleur.trim() ? values.couleur.trim() : undefined,
      nombrePlaces: useValues && values.nombrePlaces.trim() ? Number(values.nombrePlaces) : undefined,
      carburant: useValues ? (values.carburant ?? undefined) : undefined,
      categorie: useValues ? (values.categorie ?? undefined) : undefined,
      carteGrisePendingDocument: localUri && keepPhoto ? { type: 'carte_grise', localUri, expiresAt: null } : undefined,
    });
    router.replace('/flotte/nouveau/finaliser');
  }

  const hasAnyDetectedValue = Object.values(values).some((v) => (typeof v === 'string' ? v.trim() !== '' : v !== null));

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('vehicle.quickCreate.scanTitle')} showBack />

        <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
          {status === 'idle' && availability === 'loading' ? <ActivityIndicator color={M3akPalette.mauve} /> : null}

          {status === 'idle' && availability !== 'loading' && availability !== 'active' ? (
            <Card className="gap-4">
              <OcrInactiveNotice availability={availability} />
              <Button label={t('vehicle.quickCreate.manualTitle')} onPress={() => continueWithDraft(false)} />
            </Card>
          ) : null}

          {status === 'idle' && availability === 'active' ? (
            <Card className="items-center gap-4 py-10">
              <ThemedText type="small" themeColor="textSecondary" className="text-center">
                {t('vehicle.quickCreate.scanHint')}
              </ThemedText>
              <View className="w-full flex-row gap-2">
                <Button label={t('common.camera')} onPress={() => handlePick('camera')} style={{ flex: 1 }} />
                <Button
                  label={t('common.gallery')}
                  variant="secondary"
                  onPress={() => handlePick('library')}
                  style={{ flex: 1 }}
                />
              </View>
              <View className="w-full gap-3">
                <KeepPhotoChoice value={keepPhoto} onChange={setKeepPhoto} />
                <View className="rounded-2xl bg-[#FAF9FF] px-4 py-3">
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('ocr.privacyCloud')}
                  </ThemedText>
                </View>
              </View>
            </Card>
          ) : null}

          {localUri ? <Image source={{ uri: localUri }} className="h-44 w-full rounded-2xl" resizeMode="cover" /> : null}

          {status === 'processing' ? (
            <Card className="items-center gap-3 py-8">
              <ActivityIndicator color={M3akPalette.mauve} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('vehicle.quickCreate.analyzing')}
              </ThemedText>
            </Card>
          ) : null}

          {status === 'error' ? (
            <Card className="gap-3">
              <ThemedText type="smallBold">{t(scanErrorMessageKey(errorCode))}</ThemedText>
              <View className="flex-row gap-2">
                <Button
                  label={t('vehicle.quickCreate.retake')}
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    setStatus('idle');
                    setLocalUri(null);
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  label={t('vehicle.quickCreate.manualTitle')}
                  size="sm"
                  onPress={() => continueWithDraft(false)}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          ) : null}

          {status === 'result' ? (
            <View className="gap-4">
              {!hasAnyDetectedValue ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.quickCreate.nothingDetected')}
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.quickCreate.reviewHint')}
                </ThemedText>
              )}

              <ReviewField
                label={t('vehicle.fields.immatriculation')}
                value={values.immatriculation}
                onChangeText={(v) => update('immatriculation', v)}
                confidence={confidences.immatriculation}
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.vin')}
                value={values.vin}
                onChangeText={(v) => update('vin', v)}
                confidence={confidences.vin}
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.marque')}
                value={values.marque}
                onChangeText={(v) => update('marque', v)}
                confidence={confidences.marque}
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.modele')}
                value={values.modele}
                onChangeText={(v) => update('modele', v)}
                confidence={confidences.modele}
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.finition')}
                value={values.finition}
                onChangeText={(v) => update('finition', v)}
                confidence={confidences.finition}
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.annee')}
                value={values.annee}
                onChangeText={(v) => update('annee', v)}
                confidence={confidences.annee}
                keyboardType="number-pad"
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.couleur')}
                value={values.couleur}
                onChangeText={(v) => update('couleur', v)}
                confidence={confidences.couleur}
                t={t}
              />

              <View className="gap-1.5">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.fields.carburant')}
                  {confidences.carburant === 'medium' ? ` · ${t('vehicle.quickCreate.toVerify')}` : ''}
                </ThemedText>
                <ChipGroup
                  options={FUEL_TYPES}
                  selected={values.carburant}
                  getLabel={(f) => t(`vehicle.fuel.${f}`)}
                  onSelect={(f) => update('carburant', f)}
                />
              </View>

              <View className="gap-1.5">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.fields.categorie')}
                  {confidences.categorie === 'medium' ? ` · ${t('vehicle.quickCreate.toVerify')}` : ''}
                </ThemedText>
                <ChipGroup
                  options={VEHICLE_CATEGORIES}
                  selected={values.categorie}
                  getLabel={(c) => t(`vehicle.category.${c}`)}
                  onSelect={(c) => update('categorie', c)}
                />
              </View>

              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => {
                    setStatus('idle');
                    setLocalUri(null);
                  }}
                  className="flex-1 items-center rounded-2xl border border-[#EAE5F2] bg-white px-4 py-3"
                >
                  <ThemedText type="small">{t('vehicle.quickCreate.retake')}</ThemedText>
                </Pressable>
              </View>
              <Button label={t('vehicle.quickCreate.continue')} onPress={() => continueWithDraft(true)} />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ReviewField({
  label,
  value,
  onChangeText,
  confidence,
  keyboardType,
  t,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  confidence?: OcrConfidence;
  keyboardType?: 'number-pad';
  t: (key: string) => string;
}) {
  if (!value && confidence === undefined) return null;
  return (
    <View className="gap-1">
      <TextField label={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType} />
      {confidence === 'medium' ? (
        <ThemedText type="small" style={{ color: M3akPalette.warning }}>
          {t('vehicle.quickCreate.toVerify')}
        </ThemedText>
      ) : null}
    </View>
  );
}
