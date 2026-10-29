import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
};

export function ScreenHeader({ title, subtitle, showBack, right }: ScreenHeaderProps) {
  const { t, language } = useLanguage();
  const backArrow = isRTL(language) ? '>' : '<';

  return (
    <View className="gap-1 px-6 pb-4 pt-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-3">
          {showBack ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityLabel={t('common.back')}
              className="h-9 w-9 items-center justify-center rounded-full bg-white"
            >
              <ThemedText type="smallBold">{backArrow}</ThemedText>
            </Pressable>
          ) : null}
          <ThemedText type="subtitle" className="flex-1" numberOfLines={2}>
            {title}
          </ThemedText>
        </View>
        {right ? <View className="ms-3 shrink-0">{right}</View> : null}
      </View>
      {subtitle ? (
        <ThemedText type="default" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}
