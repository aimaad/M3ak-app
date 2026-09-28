import { Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

const LANGUAGE_LABEL_KEY: Record<SupportedLanguage, 'french' | 'arabic'> = {
  fr: 'french',
  ar: 'arabic',
};

export default function HomeScreen() {
  const { language, changeLanguage, t } = useLanguage();

  async function handleSelectLanguage(next: SupportedLanguage) {
    if (next === language) return;
    const { restartNeeded } = await changeLanguage(next);
    if (restartNeeded) {
      Alert.alert(t('common.appName'), t('common.restartRequired'));
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1 items-center justify-center gap-6 px-6">
        <View className="items-center gap-2">
          <ThemedText type="title" themeColor="primary" className="font-cairo-bold">
            {t('common.appName')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" className="text-center">
            {t('common.tagline')}
          </ThemedText>
        </View>

        <ThemedView type="backgroundElement" className="w-full gap-2 rounded-3xl border border-[#e1e5f0] p-6">
          <ThemedText type="subtitle" className="font-cairo-semibold">
            {t('home.welcome')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            {t('home.subtitle')}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="accent">
            {t('home.step0Done')}
          </ThemedText>
        </ThemedView>

        <View className="w-full gap-3">
          <ThemedText type="small" themeColor="textSecondary">
            {t('common.language')}
          </ThemedText>
          <View className="flex-row gap-3">
            {SUPPORTED_LANGUAGES.map((code) => {
              const selected = code === language;
              return (
                <Pressable
                  key={code}
                  onPress={() => handleSelectLanguage(code)}
                  className={`flex-1 items-center rounded-2xl border px-4 py-3 ${
                    selected ? 'border-[#1f5eff] bg-[#1f5eff]' : 'border-[#e1e5f0] bg-white'
                  }`}
                >
                  <ThemedText
                    type="smallBold"
                    style={{ color: selected ? '#ffffff' : '#101423' }}
                  >
                    {t(`common.${LANGUAGE_LABEL_KEY[code]}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
