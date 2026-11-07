import { Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { STATUS_FILTERS, type StatusFilter } from './filters';
import { Palette, Brand } from '@/constants/theme';

type StatusFilterChipsProps = {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
};

export function StatusFilterChips({ value, onChange, counts }: StatusFilterChipsProps) {
  const { t } = useLanguage();

  return (
    <ScrollView horizontal className="grow-0 shrink-0" showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-6">
      {STATUS_FILTERS.map((status) => {
        const selected = status === value;
        return (
          <Pressable
            key={status}
            onPress={() => onChange(status)}
            className={`flex-row items-center gap-1.5 rounded-full border px-4 py-2 ${
              selected ? 'border-graphite bg-graphite' : 'border-border bg-card'
            }`}
          >
            <ThemedText type="small" style={{ color: selected ? Brand.white : Palette.textPrimary }}>
              {t(`flotte.status.${status}`)}
            </ThemedText>
            <ThemedText type="small" style={{ color: selected ? Brand.white : Palette.textSecondary }}>
              {counts[status]}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
