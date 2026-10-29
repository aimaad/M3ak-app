import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

type Props = { page: number; pageCount: number; onChange: (page: number) => void };

/** Barre « Précédent · Page 2/5 · Suivant » ; masquée s'il n'y a qu'une page. */
export function Pager({ page, pageCount, onChange }: Props) {
  const { t } = useLanguage();
  if (pageCount <= 1) return null;
  const prevDisabled = page <= 1;
  const nextDisabled = page >= pageCount;
  return (
    <View className="flex-row items-center justify-between pt-2">
      <Pressable
        onPress={() => onChange(page - 1)}
        disabled={prevDisabled}
        className={`rounded-full border border-line bg-white px-4 py-2 ${prevDisabled ? 'opacity-40' : ''}`}
      >
        <ThemedText type="small">{t('common.previous')}</ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">
        {t('common.pageOf', { page, count: pageCount })}
      </ThemedText>
      <Pressable
        onPress={() => onChange(page + 1)}
        disabled={nextDisabled}
        className={`rounded-full border border-line bg-white px-4 py-2 ${nextDisabled ? 'opacity-40' : ''}`}
      >
        <ThemedText type="small">{t('common.next')}</ThemedText>
      </Pressable>
    </View>
  );
}
