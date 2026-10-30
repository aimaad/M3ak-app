import { Pressable, View } from 'react-native';

import { ThemedText } from './themed-text';
import { M3akPalette } from '@/constants/theme';

export function ChipGroup<T extends string>({
  options,
  selected,
  getLabel,
  onSelect,
  disabled,
}: {
  options: T[];
  selected: T | null;
  getLabel: (value: T) => string;
  onSelect: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected === option;
        return (
          <Pressable
            key={option}
            onPress={() => !disabled && onSelect(option)}
            disabled={disabled}
            className={`rounded-full border px-4 py-2 ${
              isSelected ? 'border-brand bg-brand' : 'border-line bg-white'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <ThemedText type="small" style={{ color: isSelected ? '#ffffff' : M3akPalette.ink }}>
              {getLabel(option)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
