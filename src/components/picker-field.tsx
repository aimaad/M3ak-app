import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/text-field';

type PickerFieldProps<T> = {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  items: T[];
  selectedItem: T | null;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string | undefined;
  filterItems: (items: T[], query: string) => T[];
  onSelect: (item: T) => void;
  error?: string;
};

export function PickerField<T>({
  label,
  placeholder,
  searchPlaceholder,
  items,
  selectedItem,
  getId,
  getLabel,
  getSubLabel,
  filterItems,
  onSelect,
  error,
}: PickerFieldProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = filterItems(items, query);

  return (
    <View className="gap-1.5">
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>

      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        className={`rounded-2xl border px-4 py-3 ${error ? 'border-[#DC2626]' : 'border-[#E4DCF5]'} bg-white`}
      >
        <ThemedText type="default" themeColor={selectedItem ? undefined : 'textSecondary'}>
          {selectedItem ? getLabel(selectedItem) : placeholder}
        </ThemedText>
      </Pressable>
      {error ? (
        <ThemedText type="small" style={{ color: '#DC2626' }}>
          {error}
        </ThemedText>
      ) : null}

      {expanded ? (
        <View className="gap-2 rounded-2xl border border-[#E4DCF5] bg-white p-3">
          <TextField placeholder={searchPlaceholder} value={query} onChangeText={setQuery} />
          <ScrollView className="max-h-52" keyboardShouldPersistTaps="handled">
            {filtered.map((item) => {
              const id = getId(item);
              const selected = selectedItem ? getId(selectedItem) === id : false;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    onSelect(item);
                    setExpanded(false);
                    setQuery('');
                  }}
                  className={`rounded-xl px-3 py-2 ${selected ? 'bg-[#EDE9FE]' : ''}`}
                >
                  <ThemedText type="smallBold">{getLabel(item)}</ThemedText>
                  {getSubLabel?.(item) ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {getSubLabel(item)}
                    </ThemedText>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
