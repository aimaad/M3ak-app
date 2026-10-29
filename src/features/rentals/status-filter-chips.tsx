import { Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { RENTAL_STATUS_FILTERS, type RentalStatusFilter } from './filters';
import { M3akPalette } from '@/constants/theme';

type RentalStatusFilterChipsProps = {
  value: RentalStatusFilter;
  onChange: (value: RentalStatusFilter) => void;
  counts: Record<RentalStatusFilter, number>;
};

export function RentalStatusFilterChips({ value, onChange, counts }: RentalStatusFilterChipsProps) {
  const { t } = useLanguage();

  return (
    <ScrollView horizontal className="grow-0 shrink-0" showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-6">
      {RENTAL_STATUS_FILTERS.map((status) => {
        const selected = status === value;
        return (
          <Pressable
            key={status}
            onPress={() => onChange(status)}
            className={`flex-row items-center gap-1.5 rounded-full border px-4 py-2 ${
              selected ? 'border-ink bg-ink' : 'border-line bg-white'
            }`}
          >
            <ThemedText type="small" style={{ color: selected ? '#ffffff' : M3akPalette.ink }}>
              {t(`locations.status.${status}`)}
            </ThemedText>
            <ThemedText type="small" style={{ color: selected ? '#ffffff' : M3akPalette.muted }}>
              {counts[status]}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
