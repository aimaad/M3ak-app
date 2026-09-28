import { Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { STATUS_FILTERS, type StatusFilter } from './filters';

type StatusFilterChipsProps = {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
};

export function StatusFilterChips({ value, onChange, counts }: StatusFilterChipsProps) {
  const { t } = useLanguage();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-6">
      {STATUS_FILTERS.map((status) => {
        const selected = status === value;
        return (
          <Pressable
            key={status}
            onPress={() => onChange(status)}
            className={`flex-row items-center gap-1.5 rounded-full border px-4 py-2 ${
              selected ? 'border-[#101423] bg-[#101423]' : 'border-[#e1e5f0] bg-white'
            }`}
          >
            <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#101423' }}>
              {t(`flotte.status.${status}`)}
            </ThemedText>
            <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#5b6478' }}>
              {counts[status]}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
