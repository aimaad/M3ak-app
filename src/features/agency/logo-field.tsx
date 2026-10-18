import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Image, View } from 'react-native';

import { Button } from '@/components/button';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { shrinkImageForUpload } from '@/features/storage/api';
import { useSignedUrl } from '@/features/storage/hooks';
import { useLanguage } from '@/i18n/use-language';

import { AGENCY_ASSETS_BUCKET } from './api';
import { useUploadAgencyLogo } from './hooks';
import { logoContentType, logoUploadErrorCode, validateLogoAsset } from './logo-validation';

type Phase = 'idle' | 'checking' | 'uploading' | 'saving' | 'done' | 'error';

/** Part de la barre : vérification 0-10 %, envoi 10-90 %, enregistrement 90-100 %. */
function barFraction(phase: Phase, uploadFraction: number): number {
  if (phase === 'checking') return 0.05;
  if (phase === 'uploading') return 0.1 + 0.78 * uploadFraction; // jamais 100 % avant la réponse du serveur
  if (phase === 'saving') return 0.95;
  if (phase === 'done') return 1;
  return 0;
}

/**
 * Logo de l'agence : obligatoire (il s'affiche en haut de chaque contrat PDF). Barre de chargement pendant l'envoi,
 * erreurs expliquées en une phrase avec un bouton « Réessayer ».
 */
export function LogoField({ agencyId, logoPath, canEdit, initial }: { agencyId: string; logoPath: string | null; canEdit: boolean; initial: string }) {
  const { t } = useLanguage();
  const upload = useUploadAgencyLogo();
  const { data: currentUrl } = useSignedUrl(AGENCY_ASSETS_BUCKET, logoPath ?? undefined);

  const [phase, setPhase] = useState<Phase>('idle');
  const [uploadFraction, setUploadFraction] = useState(0);
  const [picked, setPicked] = useState<{ uri: string } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const busy = phase === 'checking' || phase === 'uploading' || phase === 'saving';
  const missing = !logoPath && phase !== 'done';

  async function send(uri: string) {
    setErrorKey(null);
    setPhase('checking');
    setUploadFraction(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await upload.mutateAsync({
        agencyId,
        localUri: uri,
        signal: controller.signal,
        onProgress: (progress) => {
          if (progress.stage === 'uploading') {
            setPhase('uploading');
            setUploadFraction(progress.fraction);
          } else if (progress.stage === 'done') {
            setPhase('saving');
          }
        },
      });
      setPhase('done');
      setPicked(null);
    } catch (error) {
      const code = logoUploadErrorCode(error);
      if (code === 'cancelled') {
        setPhase('idle');
        setPicked(null);
        return;
      }
      setErrorKey(`entreprise.logo.errors.${code}`);
      setPhase('error');
    } finally {
      abortRef.current = null;
    }
  }

  async function pick(source: 'camera' | 'library') {
    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorKey('entreprise.logo.errors.permissionPhotos');
      setPhase('error');
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    setPicked({ uri: asset.uri });
    const problem = validateLogoAsset({ uri: asset.uri, width: asset.width, height: asset.height, fileSize: asset.fileSize, mimeType: asset.mimeType });
    if (problem) {
      setErrorKey(`entreprise.logo.errors.${problem}`);
      setPhase('error');
      return;
    }
    const type = logoContentType({ uri: asset.uri, mimeType: asset.mimeType }) ?? 'image/jpeg';
    const small = await shrinkImageForUpload(asset.uri, type, asset.width, asset.height);
    setPicked({ uri: small.uri });
    await send(small.uri);
  }

  const shownUri = picked?.uri ?? currentUrl ?? null;

  return (
    <View className="items-center gap-3">
      <View className="flex-row items-center gap-2">
        <ThemedText type="smallBold">{t('entreprise.logo.title')}</ThemedText>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: missing ? M3akPalette.dangerLight : M3akPalette.successLight }}>
          <ThemedText type="small" style={{ fontSize: 11, color: missing ? M3akPalette.danger : M3akPalette.success }}>
            {missing ? t('entreprise.logo.required') : t('entreprise.logo.ok')}
          </ThemedText>
        </View>
      </View>

      {shownUri ? (
        <Image source={{ uri: shownUri }} style={{ width: 110, height: 110, borderRadius: 16, opacity: busy ? 0.6 : 1 }} resizeMode="contain" />
      ) : (
        <View className="h-28 w-28 items-center justify-center rounded-2xl bg-[#FAF9FF]" style={missing ? { borderWidth: 1.5, borderColor: M3akPalette.danger } : undefined}>
          <ThemedText type="title" themeColor="primary">
            {initial}
          </ThemedText>
        </View>
      )}

      {missing && phase === 'idle' ? (
        <ThemedText type="small" style={{ color: M3akPalette.danger }} className="text-center">
          {canEdit ? t('entreprise.logo.missingOwner') : t('entreprise.logo.missingOther')}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          {t('entreprise.logo.help')}
        </ThemedText>
      )}

      {busy ? (
        <View className="w-full gap-1">
          <ProgressBar fraction={barFraction(phase, uploadFraction)} />
          <ThemedText type="small" themeColor="textSecondary" className="text-center">
            {phase === 'checking'
              ? t('entreprise.logo.stageChecking')
              : phase === 'uploading' && uploadFraction >= 1
                ? t('entreprise.logo.stageWaiting')
                : phase === 'uploading'
                  ? t('entreprise.logo.stageUploading', { percent: Math.round(uploadFraction * 100) })
                  : t('entreprise.logo.stageSaving')}
          </ThemedText>
          <Button label={t('entreprise.logo.cancel')} variant="ghost" size="sm" onPress={() => abortRef.current?.abort()} />
        </View>
      ) : null}

      {phase === 'done' ? (
        <ThemedText type="small" style={{ color: M3akPalette.success }}>
          {t('entreprise.logo.saved')}
        </ThemedText>
      ) : null}

      {phase === 'error' && errorKey ? (
        <View className="w-full gap-2 rounded-2xl bg-[#FEE2E2] px-4 py-3">
          <ThemedText type="small" style={{ color: M3akPalette.danger }}>
            {t(errorKey)}
          </ThemedText>
          {picked && ['entreprise.logo.errors.network', 'entreprise.logo.errors.timeout', 'entreprise.logo.errors.failed'].includes(errorKey) ? (
            <Button label={t('entreprise.logo.retry')} variant="secondary" size="sm" onPress={() => send(picked.uri)} />
          ) : null}
        </View>
      ) : null}

      {canEdit ? (
        <View className="flex-row flex-wrap justify-center gap-2">
          <Button label={t('common.camera')} variant="secondary" size="sm" disabled={busy} onPress={() => pick('camera')} />
          <Button label={logoPath ? t('entreprise.logo.change') : t('entreprise.logo.add')} variant={logoPath ? 'secondary' : 'primary'} size="sm" disabled={busy} onPress={() => pick('library')} />
        </View>
      ) : null}
    </View>
  );
}
