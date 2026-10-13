import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { setCustomerCreationDraft } from '@/features/customers/customer-creation-draft';
import {
  EMPTY_CREATION_DRAFT,
  hasAnyOcrValue,
  licenceFieldsToDraft,
  normalizeLicenceFields,
  scanLicence,
  type LicenceScanErrorCode,
} from '@/features/customers/licence-ocr';
import { useLanguage } from '@/i18n/use-language';

type Status = 'idle' | 'processing' | 'error';

async function pickImage(source: 'library' | 'camera'): Promise<string | null> {
  const permission =
    source === 'library'
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result =
    source === 'library'
      ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 })
      : await ImagePicker.launchCameraAsync({ quality: 0.5 });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/** Photo du permis → lecture par OCR → formulaire prérempli et modifiable. Jamais de valeur inventée. */
export default function ScannerPermisScreen() {
  const { t } = useLanguage();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorCode, setErrorCode] = useState<LicenceScanErrorCode | 'nothing_read' | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  async function handlePick(source: 'library' | 'camera') {
    const uri = await pickImage(source);
    if (!uri) return;
    setLocalUri(uri);
    setStatus('processing');
    setErrorCode(null);
    setErrorDetail(null);

    const result = await scanLicence(uri);
    if (!result.ok) {
      setErrorCode(result.error);
      setErrorDetail(result.detail ?? null);
      setStatus('error');
      return;
    }
    if (!hasAnyOcrValue(result.fields)) {
      setErrorCode('nothing_read');
      setStatus('error');
      return;
    }

    setCustomerCreationDraft(licenceFieldsToDraft(normalizeLicenceFields(result.fields), uri));
    router.replace('/clients/nouveau/formulaire');
  }

  /** Repli manuel : on garde la photo comme document du permis, sans aucune valeur lue. */
  function continueManually() {
    setCustomerCreationDraft({
      ...EMPTY_CREATION_DRAFT,
      pendingDocuments: localUri
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
              localUri,
            },
          ]
        : [],
    });
    router.replace('/clients/nouveau/formulaire');
  }

  const errorMessageKey =
    errorCode === 'ocr_disabled'
      ? 'customer.ocr.errorDisabled'
      : errorCode === 'ocr_not_configured'
        ? 'customer.ocr.errorNotConfigured'
        : errorCode === 'nothing_read'
          ? 'customer.ocr.errorNothingRead'
          : 'customer.ocr.errorFailed';

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('customer.create.scanTitle')} showBack />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-10">
          {status === 'idle' ? (
            <Card className="gap-4">
              <ThemedText type="small" themeColor="textSecondary">
                {t('customer.ocr.scanHint')}
              </ThemedText>
              <View className="flex-row gap-2">
                <Button label={t('common.camera')} icon="camera-outline" style={{ flex: 1 }} onPress={() => handlePick('camera')} />
                <Button label={t('common.gallery')} variant="secondary" icon="images-outline" style={{ flex: 1 }} onPress={() => handlePick('library')} />
              </View>
              <View className="rounded-2xl bg-[#FAF9FF] px-4 py-3">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('customer.ocr.privacy')}
                </ThemedText>
              </View>
            </Card>
          ) : null}

          {localUri && status !== 'idle' ? (
            <Image source={{ uri: localUri }} className="h-48 w-full rounded-2xl" resizeMode="cover" />
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
              {errorDetail ? (
                <ThemedText type="small" themeColor="textSecondary" selectable>
                  {errorDetail}
                </ThemedText>
              ) : null}
              <View className="flex-row gap-2">
                <Button
                  label={t('customer.ocr.retake')}
                  variant="secondary"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setStatus('idle');
                    setLocalUri(null);
                  }}
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
