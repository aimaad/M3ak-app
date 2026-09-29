import { Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { RENTAL_STATUS_FILTERS, type RentalStatusFilter } from './filters';

type RentalStatusFilterChipsProps = {
  value: RentalStatusFilter;
  onChange: (value: RentalStatusFilter) => void;
  counts: Record<RentalStatusFilter, number>;
};

export function RentalStatusFilterChips({ value, onChange, counts }: RentalStatusFilterChipsProps) {
  const { t } = useLanguage();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-6">
      {RENTAL_STATUS_FILTERS.map((status) => {
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
              {t(`locations.status.${status}`)}
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
