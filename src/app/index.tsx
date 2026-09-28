import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/features/auth/session-context';
import { useLanguage } from '@/i18n/use-language';

export default function Index() {
  const { session, isLoading, configError } = useSession();
  const { t } = useLanguage();

  if (configError) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1 items-center justify-center gap-3 px-8">
          <ThemedText type="subtitle" themeColor="primary" className="text-center font-cairo-semibold">
            {t('common.appName')}
          </ThemedText>
          <ThemedText type="subtitle" className="text-center font-cairo-semibold">
            {t('auth.configMissingTitle')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" className="text-center">
            {t('auth.configMissingBody')}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (isLoading) {
    return (
      <ThemedView className="flex-1">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1f5eff" />
        </View>
      </ThemedView>
    );
  }

  return <Redirect href={session ? '/flotte' : '/login'} />;
}
