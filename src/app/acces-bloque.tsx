import { Redirect } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useAgencyAccess } from '@/features/agency/hooks';
import { signOut } from '@/features/auth/api';
import { useLanguage } from '@/i18n/use-language';

/** Écran affiché quand l'essai est terminé ou l'agence suspendue : l'accès aux données est fermé côté serveur. */
export default function AccesBloqueScreen() {
  const { t } = useLanguage();
  const access = useAgencyAccess();
  const [stillBlocked, setStillBlocked] = useState(false);

  if (access.data?.hasAccess) {
    return <Redirect href="/accueil" />;
  }

  async function recheck() {
    setStillBlocked(false);
    const result = await access.refetch();
    if (!result.data?.hasAccess) setStillBlocked(true);
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1 justify-center gap-6 px-6">
        <View className="items-center gap-3">
          <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
            {t('access.blockedTitle')}
          </ThemedText>
          <ThemedText style={{ textAlign: 'center' }}>
            {t(access.data?.suspended ? 'access.blockedSuspended' : 'access.blockedExpired')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {t('access.blockedHint')}
          </ThemedText>
          {stillBlocked ? (
            <ThemedText type="small" style={{ color: M3akPalette.danger, textAlign: 'center' }}>
              {t('access.stillBlocked')}
            </ThemedText>
          ) : null}
        </View>
        <View className="gap-3">
          <Button label={t('access.recheck')} onPress={recheck} loading={access.isFetching} />
          <Button label={t('auth.signOut')} variant="secondary" onPress={() => signOut()} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
