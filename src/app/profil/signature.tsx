import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency, useMyProfile } from '@/features/agency/hooks';
import { useSaveMySignature } from '@/features/signatures/hooks';
import { buildSignature, isSignatureDrawn } from '@/features/signatures/signature';
import { SignaturePad } from '@/features/signatures/signature-pad';
import { useLanguage } from '@/i18n/use-language';

/** Petit écran pour tracer sa signature au doigt ; elle est ensuite collée automatiquement sur les contrats. */
export default function MaSignatureScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const profileQuery = useMyProfile(agencyId);
  const save = useSaveMySignature(agencyId);

  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDrawing = useCallback((drawing: boolean) => setScrollEnabled(!drawing), []);

  const handleChange = useCallback((next: string[], nextSize: { width: number; height: number }) => {
    setPaths(next);
    setSize(nextSize);
  }, []);

  const canSave = isSignatureDrawn(paths) && size.width > 0;

  async function handleSave() {
    if (!profileQuery.data || !canSave) return;
    setError(null);
    try {
      await save.mutateAsync({ memberId: profileQuery.data.id, signature: buildSignature(paths, size.width, size.height) });
      Alert.alert(t('common.appName'), t('profil.signature.saved'), [{ text: t('profil.signature.ok'), onPress: () => router.back() }]);
    } catch {
      setError(t('profil.signature.saveError'));
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('profil.signature.title')} showBack />
        {profileQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : (
          <ScrollView scrollEnabled={scrollEnabled} contentContainerClassName="gap-4 px-6 pb-10">
            <ThemedText type="default" themeColor="textSecondary">
              {t('profil.signature.help')}
            </ThemedText>
            <SignaturePad
              height={220}
              clearLabel={t('profil.signature.clear')}
              placeholder={t('profil.signature.placeholder')}
              onChange={handleChange}
              onDrawingChange={handleDrawing}
            />
            {paths.length > 0 && !canSave ? (
              <ThemedText type="small" style={{ color: M3akPalette.warning }}>
                {t('profil.signature.tooShort')}
              </ThemedText>
            ) : null}
            {error ? (
              <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                {error}
              </ThemedText>
            ) : null}
            <Button label={t('profil.signature.save')} onPress={handleSave} disabled={!canSave || save.isPending} loading={save.isPending} />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
