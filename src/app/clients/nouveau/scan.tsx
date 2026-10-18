import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ZoomableImage } from '@/components/zoomable-image';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { setCustomerCreationDraft } from '@/features/customers/customer-creation-draft';
import {
  EMPTY_CREATION_DRAFT,
  emptyLicenceFields,
  hasAnyOcrValue,
  licenceFieldsToDraft,
  licenceFilledCount,
  mergeLicenceFields,
  scanLicence,
  type LicenceOcrFields,
  type LicenceScanErrorCode,
} from '@/features/customers/licence-ocr';
import { scanErrorMessageKey } from '@/features/ocr/availability';
import { useOcrSettings } from '@/features/ocr/hooks';
import { OcrInactiveNotice } from '@/features/ocr/ocr-inactive-notice';
import { useLanguage } from '@/i18n/use-language';

type Status = 'idle' | 'processing' | 'error';
type Face = 'recto' | 'verso';

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

/** Photos du permis (recto puis verso) → une seule lecture des deux faces → formulaire prérempli et modifiable. Jamais de valeur inventée. */
export default function ScannerPermisScreen() {
  const { t } = useLanguage();
  const [photos, setPhotos] = useState<Record<Face, string | null>>({ recto: null, verso: null });
  const [status, setStatus] = useState<Status>('idle');
  const [errorCode, setErrorCode] = useState<LicenceScanErrorCode | 'nothing_read' | null>(null);
  // Le permis est obligatoire à la création d'un client : ses photos sont toujours conservées.
  const keepPhoto = true;
  const { availability, agencyId } = useOcrSettings();

  async function choosePhoto(face: Face, source: 'library' | 'camera') {
    const uri = await pickImage(source);
    if (uri) setPhotos((prev) => ({ ...prev, [face]: uri }));
  }

  /** Analyse le recto et le verso en même temps, puis fusionne les deux lectures. */
  async function analyze() {
    const entries = (['recto', 'verso'] as const).flatMap((face) => (photos[face] ? [{ face, uri: photos[face] as string }] : []));
    if (entries.length < 2) return;
    setStatus('processing');
    setErrorCode(null);

    const results = await Promise.all(entries.map((entry) => scanLicence(entry.uri, { agencyId })));
    const reads: LicenceOcrFields[] = [];
    let firstError: LicenceScanErrorCode | null = null;
    let allFromCache = true;
    results.forEach((result) => {
      if (result.ok) {
        reads.push(result.fields);
        if (!result.fromCache) allFromCache = false;
      } else firstError ??= result.error;
    });
    if (reads.length === 0) {
      setErrorCode(firstError);
      setStatus('error');
      return;
    }

    const merged = reads.reduce(mergeLicenceFields, emptyLicenceFields());
    if (!hasAnyOcrValue(merged) || licenceFilledCount(merged) === 0) {
      setErrorCode('nothing_read');
      setStatus('error');
      return;
    }

    setCustomerCreationDraft(
      licenceFieldsToDraft(merged, keepPhoto ? photos.recto : null, { fromCache: allFromCache, versoUri: keepPhoto ? photos.verso : null })
    );
    router.replace('/clients/nouveau/formulaire');
  }

  /** Repli manuel : on garde les photos comme document du permis, sans aucune valeur lue. */
  function continueManually() {
    setCustomerCreationDraft({
      ...EMPTY_CREATION_DRAFT,
      pendingDocuments:
        keepPhoto && (photos.recto || photos.verso)
          ? [
              {
                type: 'permis',
                customLabel: null,
                reference: null,
                issuingAuthority: null,
                categories: [],
                dateDelivrance: null,
                expiresAt: null,
                notes: null,
                localUri: photos.recto,
                localUriVerso: photos.verso,
              },
            ]
          : [],
    });
    router.replace('/clients/nouveau/formulaire');
  }

  const errorMessageKey = scanErrorMessageKey(errorCode);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('customer.create.scanTitle')} showBack />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-10">
          {status === 'idle' && availability === 'loading' ? <ActivityIndicator color={M3akPalette.mauve} /> : null}

          {status === 'idle' && availability !== 'loading' && availability !== 'active' ? (
            <Card className="gap-4">
              <OcrInactiveNotice availability={availability} />
              <Button label={t('customer.ocr.manual')} onPress={continueManually} />
            </Card>
          ) : null}

          {status === 'idle' && availability === 'active' ? (
            <Card className="gap-4">
              <ThemedText type="small" themeColor="textSecondary">
                {t('customer.ocr.scanHint')}
              </ThemedText>
              {(['recto', 'verso'] as const).map((face) => (
                <View key={face} className="gap-2">
                  <ThemedText type="smallBold">{t(`vehicle.quickCreate.face.${face}`)}</ThemedText>
                  {photos[face] ? (
                    <View style={{ height: 150 }}>
                      <ZoomableImage uri={photos[face] as string} label={t(`vehicle.quickCreate.face.${face}`)} style={{ borderRadius: 16 }} />
                    </View>
                  ) : null}
                  <View className="flex-row gap-2">
                    <Button
                      label={photos[face] ? t('vehicle.quickCreate.photoChange') : t('common.camera')}
                      variant={photos[face] ? 'secondary' : 'primary'}
                      size="sm"
                      icon="camera-outline"
                      style={{ flex: 1 }}
                      onPress={() => choosePhoto(face, 'camera')}
                    />
                    <Button label={t('common.gallery')} variant="secondary" size="sm" icon="images-outline" style={{ flex: 1 }} onPress={() => choosePhoto(face, 'library')} />
                  </View>
                </View>
              ))}
              <ThemedText type="small" themeColor="textSecondary">
                {photos.recto && photos.verso ? '' : t('customer.ocr.bothRequired')}
              </ThemedText>
              <Button label={t('customer.ocr.analyzeBoth')} disabled={!photos.recto || !photos.verso} onPress={analyze} />
              <View className="rounded-2xl bg-[#FAF9FF] px-4 py-3">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('ocr.privacyCloud')}
                </ThemedText>
              </View>
            </Card>
          ) : null}

          {status === 'processing' ? (
            <Card className="flex-row items-center gap-3">
              <ActivityIndicator color={M3akPalette.mauve} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('customer.ocr.analyzing')}
              </ThemedText>
            </Card>
          ) : null}

          {status === 'error' ? (
            <Card className="gap-3">
              <ThemedText type="smallBold">{t(errorMessageKey)}</ThemedText>
              <View className="flex-row gap-2">
                <Button
                  label={t('customer.ocr.retake')}
                  variant="secondary"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => setStatus('idle')}
                />
                <Button label={t('customer.ocr.manual')} size="sm" style={{ flex: 1 }} onPress={continueManually} />
              </View>
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
